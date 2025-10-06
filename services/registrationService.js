const prisma = require("../config/prismaClient");
const { v4: uuidv4 } = require("uuid");
const midtransClient = require("midtrans-client");
const crypto = require("crypto");
const ReferralService = require("./referralService");
const { sendConfirmationEmail } = require("../utils/emailService");

function formatMidtransTime(date = new Date()) {
  const pad = (n) => (n < 10 ? "0" + n : n);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} +0700`;
}

async function validateReferralCode(code, price) {
  if (!code) return { valid: false, discount: 0 };

  // console.log(`Validating referral code: ${code} for price: ${price}`)

  const referral = await prisma.referralCode.findFirst({
    where: {
      code: code,
      isActive: true,
      OR: [{ validFrom: null }, { validFrom: { lte: new Date() } }],
      AND: [
        {
          OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
        },
      ],
    },
  });

  if (!referral) {
    // console.log(`Referral code ${code} not found or inactive`);
    return { valid: false, discount: 0 };
  }

  let discount = 0;
  if (referral.discountType === "fixed") {
    discount = Math.min(price, referral.discountValue);
  } else if (
    referral.discountType === "percent" ||
    referral.discountType === "percentage"
  ) {
    discount = Math.floor((price * referral.discountValue) / 100);
  }

  // console.log(`Discount calculated: ${discount} for code ${code}`);

  await prisma.referralCode.update({
    where: { id: referral.id },
    data: { usedCount: { increment: 1 } },
  });

  return { valid: true, discount };
}

class RegistrationService {
  constructor() {
    this.snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
      serverKey: process.env.MIDTRANS_SERVER_KEY,
    });

    this.coreApi = new midtransClient.CoreApi({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
      serverKey: process.env.MIDTRANS_SERVER_KEY,
    });
  }

  async createRegistration(registrationData) {
    try {
      return await prisma.$transaction(async (tx) => {
        const {
          program_id,
          contact_name,
          contact_email,
          contact_phone,
          participants,
        } = registrationData;

        const program = await tx.program.findUnique({
          where: { id: program_id },
        });

        if (!program) {
          throw new Error("Program tidak ditemukan");
        }

        const now = new Date();
        const isEarlyBirdActive =
          program.earlyBirdEndDate && new Date(program.earlyBirdEndDate) >= now;

        const activePrice =
          isEarlyBirdActive && program.earlyBirdPrice
            ? program.earlyBirdPrice
            : program.price;

        const usedEarlyBird = Boolean(
          isEarlyBirdActive && program.earlyBirdPrice
        );

        const registrationId = `REG-${Date.now()}-${uuidv4().substring(0, 8)}`;

        const registration = await tx.registration.create({
          data: {
            registrationId,
            programId: program_id,
            contactName: contact_name,
            contactEmail: contact_email,
            contactPhone: contact_phone,
            totalParticipants: participants.length,
            totalAmount: 0,
            paymentStatus: "pending",
            usedEarlyBird: usedEarlyBird,
          },
        });

        let subtotal = 0;
        const participantData = [];
        for (const participant of participants) {
          let discount = participant.discount_amount || 0;
          let referralCode = participant.referral_code || null;
          if (referralCode && discount === 0) {
            const result = await validateReferralCode(
              referralCode,
              activePrice
            );
            discount = result.discount;
          }
          participant.discount_amount = discount;
          subtotal += activePrice - discount;
          participantData.push({
            registrationId: registration.id,
            name: participant.name,
            email: participant.email,
            phone: participant.phone,
            city: participant.city || null,
            referralCode: referralCode,
            discountAmount: discount,
          });
        }

        const ppn = Math.round(subtotal * 0.11);
        const totalAmount = subtotal + ppn;

        await tx.participant.createMany({
          data: participantData,
        });

        for (const p of participantData) {
          if (p.referralCode) {
            await ReferralService.recordReferralUsage(
              p.referralCode,
              registration.id,
              p.discountAmount
            );
          }
        }

        const midtransOrderId = `ORDER-${registration.id}-${Date.now()}`;

        const item_details = participants.map((p, i) => ({
          id: `${program_id}-P${i + 1}`,
          price: activePrice,
          quantity: 1,
          name: `${program.title} - Peserta ${i + 1}`,
          brand: "Legacy Training",
          category: "Training Program",
        }));

        participants.forEach((p, i) => {
          const discountAmount = p.discount_amount || 0;
          // console.log(`Checking discount for Peserta ${i + 1}:`, {
          //   referral_code: p.referral_code,
          //   discount_amount: discountAmount,
          // });

          if (discountAmount > 0) {
            item_details.push({
              id: `DISC-P${i + 1}`,
              price: -discountAmount,
              quantity: 1,
              name: `Referral Discount - ${p.referral_code}`,
            });
          }
        });

        item_details.push({
          id: "PPN",
          price: ppn,
          quantity: 1,
          name: "PPN 11%",
          category: "Tax",
        });

        const parameter = {
          transaction_details: {
            order_id: midtransOrderId,
            gross_amount: totalAmount,
          },
          credit_card: { secure: true },
          customer_details: {
            first_name: contact_name,
            email: contact_email,
            phone: contact_phone,
          },
          item_details,
          callbacks: {
            finish: `${process.env.LANDING_FRONTEND_URL}/payment/status/${registrationId}`,
            error: `${process.env.LANDING_FRONTEND_URL}/payment/status/${registrationId}`,
            pending: `${process.env.LANDING_FRONTEND_URL}/payment/status/${registrationId}`,
          },
          expiry: {
            start_time: formatMidtransTime(),
            unit: "minutes",
            duration: 60,
          },
          custom_field1: registrationId,
          custom_field2: `Training-${program.title}`,
          custom_field3: `Participants-${participants.length}`,
        };

        // console.log(
        //   "Creating Midtrans transaction with parameter:",
        //   JSON.stringify(parameter, null, 2)
        // );

        const transaction = await this.snap.createTransaction(parameter);

        // console.log("Midtrans transaction created:", transaction);
        // console.log("Subtotal:", subtotal);
        // console.log(
        //   "Total diskon:",
        //   participants.reduce((a, b) => a + b.discount_amount, 0)
        // );
        // console.log("PPN:", ppn);
        // console.log("TotalAmount:", totalAmount);
        // console.log(
        //   "Sum item_details:",
        //   item_details.reduce((a, b) => a + b.price * b.quantity, 0)
        // );

        await tx.registration.update({
          where: { id: registration.id },
          data: {
            totalAmount,
            paymentUrl: transaction.redirect_url,
            midtransOrderId,
          },
        });

        await tx.paymentLog.create({
          data: {
            orderId: midtransOrderId,
            transactionStatus: "created",
            mappedStatus: "pending",
            notificationData: {
              registrationId: registration.id,
              amount: totalAmount,
              participants: participantData.length,
            },
            registrationId: registration.id,
          },
        });

        return {
          registration_id: registrationId,
          payment_url: transaction.redirect_url,
          midtrans_token: transaction.token,
          total_amount: totalAmount,
          order_id: midtransOrderId,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        };
      });
    } catch (error) {
      console.error("Error creating registration:", error);
      throw error;
    }
  }

  async getRegistrationById(registrationId) {
    try {
      const registration = await prisma.registration.findUnique({
        where: { registrationId },
        include: {
          program: {
            select: {
              title: true,
              duration: true,
              price: true,
              earlyBirdPrice: true,
            },
          },
          participants: {
            select: {
              name: true,
              email: true,
              phone: true,
              referralCode: true,
              discountAmount: true,
            },
          },
        },
      });

      if (!registration) {
        return null;
      }

      const calculateActualPrice = () => {
        if (registration.usedEarlyBird && registration.program.earlyBirdPrice) {
          return registration.program.earlyBirdPrice;
        }
        return registration.program.price;
      };

      const actualPricePerParticipant = calculateActualPrice();

      const discountTotal = registration.participants.reduce(
        (sum, p) => sum + (p.discountAmount || 0),
        0
      );

      return {
        ...registration,
        program: {
          title: registration.program.title,
          duration: registration.program.duration,
          price: actualPricePerParticipant,
        },
        program_title: registration.program.title,
        duration: registration.program.duration,
        program_price: actualPricePerParticipant,
        actual_price_per_participant: actualPricePerParticipant,
        discount_total: discountTotal,
        grand_total: registration.totalAmount,
      };
    } catch (error) {
      console.error("Error fetching registration:", error);
      throw new Error(`Error fetching registration: ${error.message}`);
    }
  }

  async handlePaymentNotification(notification) {
    try {
      // console.log(
      //   "Processing payment notification:",
      //   JSON.stringify(notification, null, 2)
      // );

      if (!this.validateNotificationSignature(notification)) {
        throw new Error("Invalid notification signature");
      }

      const {
        order_id,
        transaction_status,
        fraud_status,
        transaction_id,
        payment_type,
        gross_amount,
      } = notification;

      const paymentStatus = this.mapPaymentStatus(
        transaction_status,
        fraud_status
      );

      // console.log(
      //   `Payment status for ${order_id}: ${transaction_status} (fraud: ${fraud_status}) -> ${paymentStatus}`
      // );

      const updateData = {
        paymentStatus,
        midtransTransactionId: transaction_id,
        paymentType: payment_type,
      };

      if (paymentStatus === "paid") {
        updateData.paidAt = new Date();
      }

      const reg = await prisma.registration.findFirst({
        where: { midtransOrderId: order_id },
      });

      if (!reg) {
        throw new Error(`Registration not found for order_id: ${order_id}`);
      }

      const registration = await prisma.registration.update({
        where: { id: reg.id },
        data: updateData,
      });

      if (paymentStatus === "paid") {
        const participants = await prisma.participant.findMany({
          where: { registrationId: reg.id },
        });
      
        for (const participant of participants) {
          try {
            await sendConfirmationEmail(participant);
          } catch (err) {
            console.error(`Failed to send email to ${participant.email}:`, err);
          }
        }
      }

      if (!registration) {
        throw new Error(`Registration not found for order_id: ${order_id}`);
      }

      await prisma.paymentLog.create({
        data: {
          orderId: order_id,
          transactionStatus: transaction_status,
          fraudStatus: fraud_status || null,
          mappedStatus: paymentStatus,
          notificationData: notification,
          paymentType: payment_type,
          registration: { connect: { id: registration.id } },
        },
      });

      return {
        success: true,
        payment_status: paymentStatus,
        order_id: order_id,
        transaction_id: transaction_id,
      };
    } catch (error) {
      console.error("Error handling payment notification:", error);
      throw new Error(`Error handling payment notification: ${error.message}`);
    }
  }

  validateNotificationSignature(notification) {
    try {
      const { order_id, status_code, gross_amount, signature_key } =
        notification;
      const serverKey = process.env.MIDTRANS_SERVER_KEY;

      const input = order_id + status_code + gross_amount + serverKey;
      const hash = crypto.createHash("sha512").update(input).digest("hex");

      const isValid = hash === signature_key;
      // console.log(
      //   `Signature validation for ${order_id}: ${isValid ? "VALID" : "INVALID"}`
      // );

      return isValid;
    } catch (error) {
      console.error("Signature validation error:", error);
      return false;
    }
  }

  mapPaymentStatus(midtransStatus, fraudStatus = null) {
    switch (midtransStatus) {
      case "capture":
        return fraudStatus === "accept" ? "paid" : "pending";
      case "settlement":
        return "paid";
      case "pending":
        return "pending";
      case "deny":
      case "cancel":
      case "expire":
      case "failure":
        return "failed";
      case "cancelled":
        return "cancelled";
      case "expired":
        return "expired";
      default:
        return "pending";
    }
  }

  async logPaymentNotification(
    notification,
    mappedStatus,
    registrationId = null
  ) {
    try {
      await prisma.paymentLog.create({
        data: {
          orderId: notification.order_id,
          transactionStatus: notification.transaction_status,
          fraudStatus: notification.fraud_status || null,
          mappedStatus: mappedStatus,
          notificationData: notification,
          registrationId: registrationId,
        },
      });

      // console.log("Payment notification logged");
    } catch (error) {
      console.error("Error logging payment notification:", error);
    }
  }

  async checkTransactionStatus(orderId) {
    try {
      const statusResponse = await this.coreApi.transaction.status(orderId);
      // console.log(`Transaction status for ${orderId}:`, statusResponse);

      return {
        success: true,
        data: statusResponse,
      };
    } catch (error) {
      console.error("Error checking transaction status:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async cancelTransaction(orderId) {
    try {
      const registration = await prisma.registration.findFirst({
        where: { midtransOrderId: orderId },
        include: { participants: true },
      });

      if (!registration) {
        throw new Error(`Registration not found for orderId: ${orderId}`);
      }

      if (registration.paymentStatus === "pending") {
        const participantsWithReferral = registration.participants.filter(
          (p) => p.referralCode
        );

        for (const participant of participantsWithReferral) {
          await prisma.referralCode
            .update({
              where: { code: participant.referralCode },
              data: { usedCount: { decrement: 1 } },
            })
            .catch((err) => {
              console.error(
                `Failed to decrement usage count for referral code ${participant.referralCode}:`,
                err
              );
            });

          await prisma.referralUsageHistory
            .deleteMany({
              where: {
                registrationId: registration.id,
                referralCode: participant.referralCode,
              },
            })
            .catch((err) => {
              console.error(
                `Failed to delete referral usage history for ${participant.referralCode}:`,
                err
              );
            });
        }

        await prisma.participant.deleteMany({
          where: { registrationId: registration.id },
        });
        await prisma.registration.delete({
          where: { id: registration.id },
        });

        return {
          success: true,
          message: "Registration cancelled and deleted",
        };
      }

      // if (registration.referralCode) {
      //   // Kurangi kembali usedCount
      //   await prisma.referralCode.update({
      //     where: { code: registration.referralCode },
      //     data: { usedCount: { decrement: 1 } },
      //   });

      //   // Hapus riwayat referral usage jika ada
      //   await prisma.referralUsageHistory.deleteMany({
      //     where: { registrationId: registration.id },
      //   });
      // }

      const cancelResponse = await this.coreApi.transaction.cancel(orderId);
      await prisma.registration.update({
        where: { id: registration.id },
        data: { paymentStatus: "cancelled" },
      });

      await prisma.paymentLog.create({
        data: {
          orderId,
          transactionStatus: "cancelled",
          mappedStatus: "cancelled",
          registrationId: registration.id,
          notificationData: { message: "Transaction cancelled manually" },
        },
      });

      return {
        success: true,
        data: cancelResponse,
      };
    } catch (error) {
      console.error("Error cancelling transaction:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Mendapatkan semua registrasi
  async getAllRegistrations(filters = {}) {
    try {
      const whereClause = {};

      if (filters.payment_status) {
        whereClause.paymentStatus = filters.payment_status;
      }

      if (filters.program_id) {
        whereClause.programId = parseInt(filters.program_id);
      }

      if (filters.start_date || filters.end_date) {
        whereClause.createdAt = {};
        if (filters.start_date) {
          whereClause.createdAt.gte = new Date(filters.start_date);
        }
        if (filters.end_date) {
          whereClause.createdAt.lte = new Date(filters.end_date);
        }
      }

      const queryOptions = {
        where: whereClause,
        include: {
          program: {
            select: { title: true },
          },
        },
        orderBy: { createdAt: "desc" },
      };

      if (filters.limit) {
        queryOptions.take = parseInt(filters.limit);
      }

      const registrations = await prisma.registration.findMany(queryOptions);

      return registrations.map((reg) => ({
        ...reg,
        program_title: reg.program.title,
      }));
    } catch (error) {
      console.error("Error fetching registrations:", error);
      throw new Error(`Error fetching registrations: ${error.message}`);
    }
  }

  async getRegistrationStats(filters = {}) {
    try {
      const whereClause = {};

      if (filters.start_date && filters.end_date) {
        whereClause.createdAt = {
          gte: new Date(filters.start_date),
          lte: new Date(filters.end_date),
        };
      }

      const totalRegistrations = await prisma.registration.count({
        where: whereClause,
      });

      const statusCounts = await prisma.registration.groupBy({
        by: ["paymentStatus"],
        where: whereClause,
        _count: true,
      });

      const byStatus = statusCounts.reduce((acc, item) => {
        acc[item.paymentStatus] = item._count;
        return acc;
      }, {});

      const revenueWhere = { ...whereClause, paymentStatus: "paid" };
      if (filters.start_date && filters.end_date) {
        revenueWhere.paidAt = {
          gte: new Date(filters.start_date),
          lte: new Date(filters.end_date),
        };
        delete revenueWhere.createdAt;
      }

      const revenueResult = await prisma.registration.aggregate({
        where: revenueWhere,
        _sum: { totalAmount: true },
      });

      const totalRevenue = revenueResult._sum.totalAmount || 0;

      const popularPrograms = await prisma.registration.groupBy({
        by: ["programId"],
        where: whereClause,
        _count: true,
        orderBy: { _count: { _all: "desc" } },
        take: 5,
      });

      const programIds = popularPrograms.map((p) => p.programId);
      const programs = await prisma.program.findMany({
        where: { id: { in: programIds } },
        select: { id: true, title: true },
      });

      const programMap = programs.reduce((acc, prog) => {
        acc[prog.id] = prog.title;
        return acc;
      }, {});

      const popularProgramsWithTitles = popularPrograms.map((item) => ({
        title: programMap[item.programId],
        registration_count: item._count,
      }));

      return {
        total_registrations: totalRegistrations,
        by_status: byStatus,
        total_revenue: totalRevenue,
        popular_programs: popularProgramsWithTitles,
      };
    } catch (error) {
      console.error("Error fetching registration stats:", error);
      throw new Error(`Error fetching registration stats: ${error.message}`);
    }
  }

  async syncPaymentStatus(registrationId) {
    try {
      const registration = await prisma.registration.findUnique({
        where: { registrationId },
      });

      if (!registration || !registration.midtransOrderId) {
        throw new Error("Registration or Midtrans order ID not found");
      }

      const statusCheck = await this.checkTransactionStatus(
        registration.midtransOrderId
      );

      if (!statusCheck.success) {
        throw new Error("Failed to check transaction status from Midtrans");
      }

      const midtransData = statusCheck.data;
      const mappedStatus = this.mapPaymentStatus(
        midtransData.transaction_status,
        midtransData.fraud_status
      );

      if (registration.paymentStatus !== mappedStatus) {
        const updateData = {
          paymentStatus: mappedStatus,
          midtransTransactionId: midtransData.transaction_id,
        };

        if (mappedStatus === "paid") {
          updateData.paidAt = new Date();
        }

        await prisma.registration.update({
          where: { registrationId },
          data: updateData,
        });

        // console.log(
        //   `Payment status synced for ${registrationId}: ${registration.paymentStatus} -> ${mappedStatus}`
        // );
      }

      return {
        registration_id: registrationId,
        old_status: registration.paymentStatus,
        new_status: mappedStatus,
        midtrans_data: midtransData,
      };
    } catch (error) {
      console.error("Error syncing payment status:", error);
      throw new Error(`Error syncing payment status: ${error.message}`);
    }
  }
}

module.exports = new RegistrationService();
