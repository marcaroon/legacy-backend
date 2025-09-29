const registrationService = require("../services/registrationService");
const ReferralService = require("../services/referralService");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

class RegistrationController {
  static async createRegistration(req, res) {
    try {
      console.log(
        "Creating registration with data:",
        JSON.stringify(req.body, null, 2)
      );

      const {
        program_id,
        contact_name,
        contact_email,
        contact_phone,
        participants,
      } = req.body;

      const validationErrors = [];

      if (!program_id || isNaN(parseInt(program_id))) {
        validationErrors.push("program_id must be a valid number");
      }
      if (!contact_name || !contact_name.trim()) {
        validationErrors.push("contact_name is required");
      }
      if (!contact_email || !contact_email.trim()) {
        validationErrors.push("contact_email is required");
      }
      if (!contact_phone || !contact_phone.trim()) {
        validationErrors.push("contact_phone is required");
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (contact_email && !emailRegex.test(contact_email.trim())) {
        validationErrors.push("contact_email format is invalid");
      }

      if (
        !participants ||
        !Array.isArray(participants) ||
        participants.length === 0
      ) {
        validationErrors.push("participants must be a non-empty array");
      } else {
        participants.forEach((participant, index) => {
          if (!participant.name || !participant.name.trim()) {
            validationErrors.push(`participant[${index}].name is required`);
          }
          if (!participant.email || !participant.email.trim()) {
            validationErrors.push(`participant[${index}].email is required`);
          } else if (!emailRegex.test(participant.email.trim())) {
            validationErrors.push(
              `participant[${index}].email format is invalid`
            );
          }
          if (!participant.phone || !participant.phone.trim()) {
            validationErrors.push(`participant[${index}].phone is required`);
          }
        });
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: validationErrors,
        });
      }

      const cleanedData = {
        program_id: parseInt(program_id),
        contact_name: contact_name.trim(),
        contact_email: contact_email.trim().toLowerCase(),
        contact_phone: contact_phone.trim(),
        participants: participants.map((p) => ({
          name: p.name.trim(),
          email: p.email.trim().toLowerCase(),
          phone: p.phone.trim(),
          referral_code: p.referral_code
            ? p.referral_code.trim().toUpperCase()
            : null,
        })),
      };

      console.log(
        "Cleaned registration data:",
        JSON.stringify(cleanedData, null, 2)
      );

      const result = await registrationService.createRegistration(cleanedData);

      console.log("Registration created successfully:", result);

      res.status(201).json({
        success: true,
        data: result,
        message: "Registration created successfully",
      });
    } catch (error) {
      console.error("Error in createRegistration:", error);

      // Handle specific error types
      let statusCode = 500;
      let message = "Failed to create registration";

      if (
        error.message.includes("Program tidak ditemukan") ||
        error.message.includes("Program not found")
      ) {
        statusCode = 404;
        message = "Program not found";
      } else if (
        error.message.includes("validation") ||
        error.message.includes("required") ||
        error.message.includes("invalid")
      ) {
        statusCode = 400;
        message = "Invalid input data";
      } else if (
        error.message.includes("Midtrans") ||
        error.message.includes("payment gateway")
      ) {
        statusCode = 502;
        message = "Payment gateway error";
      }

      res.status(statusCode).json({
        success: false,
        message: message,
        error: error.message,
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
      });
    }
  }

  // GET /api/registration/:registrationId
  static async getRegistrationById(req, res) {
    try {
      const { registrationId } = req.params;

      if (!registrationId) {
        return res.status(400).json({
          success: false,
          message: "Registration ID is required",
        });
      }


      const registration = await registrationService.getRegistrationById(
        registrationId
      );

      if (!registration) {
        return res.status(404).json({
          success: false,
          message: "Registration not found",
        });
      }

      res.json({
        success: true,
        data: registration,
        message: "Registration retrieved successfully",
      });
    } catch (error) {
      console.error("Error in getRegistrationById:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve registration",
        error: error.message,
      });
    }
  }

  // GET /api/registrations
  static async getAllRegistrations(req, res) {
    try {
      const filters = {
        payment_status: req.query.status,
        program_id: req.query.program_id
          ? parseInt(req.query.program_id)
          : undefined,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      };

      // Remove null/undefined/empty values
      Object.keys(filters).forEach((key) => {
        if (
          filters[key] === null ||
          filters[key] === undefined ||
          filters[key] === ""
        ) {
          delete filters[key];
        }
      });

      const registrations = await registrationService.getAllRegistrations(
        filters
      );

      res.json({
        success: true,
        data: registrations,
        count: registrations.length,
        filters: filters,
        message: "Registrations retrieved successfully",
      });
    } catch (error) {
      console.error("Error in getAllRegistrations:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve registrations",
        error: error.message,
      });
    }
  }

  // GET /api/registrations/stats
  static async getRegistrationStats(req, res) {
    try {
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date,
      };

      // Remove null values
      Object.keys(filters).forEach((key) => {
        if (
          filters[key] === null ||
          filters[key] === undefined ||
          filters[key] === ""
        ) {
          delete filters[key];
        }
      });

      console.log("Fetching registration stats with filters:", filters);

      const stats = await registrationService.getRegistrationStats(filters);

      res.json({
        success: true,
        data: stats,
        filters: filters,
        message: "Registration statistics retrieved successfully",
      });
    } catch (error) {
      console.error("Error in getRegistrationStats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve registration statistics",
        error: error.message,
      });
    }
  }

  // POST /api/payment/notification - Midtrans webhook
  static async handlePaymentNotification(req, res) {
    try {
      console.log("=== PAYMENT NOTIFICATION RECEIVED ===");
      console.log("Headers:", req.headers);
      console.log("Body:", JSON.stringify(req.body, null, 2));

      if (!req.body || Object.keys(req.body).length === 0) {
        console.log("Empty notification body");
        return res.status(400).json({
          success: false,
          message: "Empty notification body",
        });
      }

      const result = await registrationService.handlePaymentNotification(
        req.body
      );

      console.log("Payment notification processed successfully:", result);

      // Midtrans expects simple response
      res.status(200).json({
        success: true,
        message: "OK",
      });
    } catch (error) {
      console.error("Error in handlePaymentNotification:", error);

      // Still return 200 to Midtrans to prevent retries for invalid notifications
      res.status(200).json({
        success: false,
        message: "Notification processed with error",
        error: error.message,
      });
    }
  }

  // GET /api/payment/status/:registrationId
  static async getPaymentStatus(req, res) {
    try {
      const { registrationId } = req.params;

      if (!registrationId) {
        return res.status(400).json({
          success: false,
          message: "Registration ID is required",
        });
      }

      console.log(`Checking payment status for: ${registrationId}`);

      const registration = await registrationService.getRegistrationById(
        registrationId
      );

      if (!registration) {
        return res.status(404).json({
          success: false,
          message: "Registration not found",
        });
      }

      res.json({
        success: true,
        data: {
          registration_id: registration.registrationId,
          payment_status: registration.paymentStatus,
          paid_at: registration.paidAt,
          total_amount: registration.totalAmount,
          payment_type: registration.paymentType,
          midtrans_transaction_id: registration.midtransTransactionId,
          created_at: registration.createdAt,
        },
        message: "Payment status retrieved successfully",
      });
    } catch (error) {
      console.error("Error in getPaymentStatus:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve payment status",
        error: error.message,
      });
    }
  }

  // POST /api/payment/check/:registrationId - Manual sync dengan Midtrans
  static async checkPaymentStatus(req, res) {
    try {
      const { registrationId } = req.params;

      if (!registrationId) {
        return res.status(400).json({
          success: false,
          message: "Registration ID is required",
        });
      }

      console.log(
        `Syncing payment status with Midtrans for: ${registrationId}`
      );

      const result = await registrationService.syncPaymentStatus(
        registrationId
      );

      res.json({
        success: true,
        data: result,
        message: "Payment status synchronized successfully",
      });
    } catch (error) {
      console.error("Error in checkPaymentStatus:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync payment status",
        error: error.message,
      });
    }
  }

  // DELETE /api/registration/:registrationId/cancel
  static async cancelRegistration(req, res) {
    try {
      const { registrationId } = req.params;

      if (!registrationId) {
        return res.status(400).json({
          success: false,
          message: "Registration ID is required",
        });
      }

      console.log(`Cancelling registration: ${registrationId}`);

      const registration = await registrationService.getRegistrationById(
        registrationId
      );

      if (!registration) {
        return res.status(404).json({
          success: false,
          message: "Registration not found",
        });
      }

      // Check payment status - use camelCase field from Prisma
      if (registration.paymentStatus === "paid") {
        return res.status(400).json({
          success: false,
          message: "Cannot cancel paid registration",
        });
      }

      let result = { success: true };

      // Cancel di Midtrans jika ada order ID dan masih pending
      if (
        registration.midtransOrderId &&
        registration.paymentStatus === "pending"
      ) {
        result = await registrationService.cancelTransaction(
          registration.midtransOrderId
        );
      }

      if (result.success) {
        res.json({
          success: true,
          message: "Registration cancelled successfully",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to cancel registration",
          error: result.error || "Unknown error occurred",
        });
      }
    } catch (error) {
      console.error("Error in cancelRegistration:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel registration",
        error: error.message,
      });
    }
  }

  static async exportRegistrationsToExcel(req, res) {
    try {
      const filters = {
        payment_status: req.query.status,
        program_id: req.query.program_id
          ? parseInt(req.query.program_id)
          : undefined,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
      };

      // Remove null/undefined/empty values
      Object.keys(filters).forEach((key) => {
        if (
          filters[key] === null ||
          filters[key] === undefined ||
          filters[key] === ""
        ) {
          delete filters[key];
        }
      });

      console.log("Exporting registrations with filters:", filters);

      const registrations = await registrationService.getAllRegistrations(
        filters
      );

      // Buat workbook baru
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Registrations");

      // Set column headers
      worksheet.columns = [
        { header: "Registration ID", key: "registrationId", width: 20 },
        { header: "Midtrans Order ID", key: "midtransOrderId", width: 25 },
        { header: "Contact Name", key: "contactName", width: 25 },
        { header: "Contact Email", key: "contactEmail", width: 30 },
        { header: "Contact Phone", key: "contactPhone", width: 18 },
        { header: "Program Title", key: "program_title", width: 30 },
        { header: "Total Participants", key: "totalParticipants", width: 18 },
        { header: "Total Amount (Rp)", key: "totalAmount", width: 18 },
        { header: "Payment Status", key: "paymentStatus", width: 15 },
        { header: "Payment Type", key: "paymentType", width: 15 },
        { header: "Payment Date", key: "paidAt", width: 20 },
        { header: "Registration Date", key: "createdAt", width: 20 },
      ];

      // Style header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE6F3FF" },
      };

      // Add data rows
      registrations.forEach((reg) => {
        worksheet.addRow({
          registrationId: reg.registrationId,
          midtransOrderId: reg.midtransOrderId || "-",
          contactName: reg.contactName,
          contactEmail: reg.contactEmail,
          contactPhone: reg.contactPhone,
          program_title: reg.program_title,
          totalParticipants: reg.totalParticipants,
          totalAmount: reg.totalAmount,
          paymentStatus: reg.paymentStatus,
          paymentType: reg.paymentType || "-",
          paidAt: reg.paidAt
            ? new Date(reg.paidAt).toLocaleString("id-ID")
            : "-",
          createdAt: new Date(reg.createdAt).toLocaleString("id-ID"),
        });
      });

      // Format currency column
      const amountColumn = worksheet.getColumn("totalAmount");
      amountColumn.numFmt = "#,##0";

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        if (column.width < 10) column.width = 10;
      });

      // Set response headers
      const fileName = `registrations_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Error exporting registrations to Excel:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export registrations to Excel",
        error: error.message,
      });
    }
  }

  static async downloadInvoice(req, res) {
    try {
      const { registrationId } = req.params;
      const registration = await registrationService.getRegistrationById(
        registrationId
      );

      if (!registration) {
        return res
          .status(404)
          .json({ success: false, message: "Registration not found" });
      }

      const doc = new PDFDocument({ margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=INVOICE-${registrationId}.pdf`
      );

      doc.pipe(res);

      doc.fontSize(22).text("INVOICE", { align: "center" });
      doc.moveDown();
      doc.fontSize(12).text(`Registration ID: ${registration.registrationId}`);
      if (registration.paidAt) {
        doc.text(
          `Tanggal Bayar: ${new Date(registration.paidAt).toLocaleString(
            "id-ID"
          )}`
        );
      }
      doc.moveDown(2);

      doc.fontSize(14).text("Informasi Registrasi", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Nama Kontak   : ${registration.contactName}`);
      doc.text(`Email          : ${registration.contactEmail}`);
      doc.text(`Program        : ${registration.program_title}`);
      doc.text(`Durasi         : ${registration.duration}`);
      doc.text(
        `Harga Normal   : Rp${registration.program?.price?.toLocaleString(
          "id-ID"
        )}`
      );

      if (registration.usedEarlyBird) {
        doc.text(
          `Harga Early Bird: Rp${registration.actual_price_per_participant.toLocaleString(
            "id-ID"
          )}`,
          { continued: false }
        );
      }
      doc.text(`Status         : ${registration.paymentStatus}`);
      doc.moveDown(2);

      doc.fontSize(14).text("Daftar Peserta", { underline: true });
      doc.moveDown(0.5);
      registration.participants.forEach((p, i) => {
        doc.fontSize(12).text(`${i + 1}. ${p.name} - ${p.email} - ${p.phone}`);
        if (p.referralCode) {
          doc
            .fontSize(11)
            .fillColor("green")
            .text(
              `   Referral Code: ${
                p.referralCode
              } (- Rp${p.discountAmount.toLocaleString("id-ID")})`
            );
          doc.fillColor("black");
        }
        doc.moveDown(0.5);
      });
      doc.moveDown(1.5);

      doc.fontSize(14).text("Ringkasan Biaya", { underline: true });
      doc.moveDown(0.5);

      const subtotal =
        registration.totalParticipants *
        registration.actual_price_per_participant;

      doc
        .fontSize(12)
        .text(
          `Harga per Peserta: Rp${registration.actual_price_per_participant.toLocaleString(
            "id-ID"
          )}`
        );
      doc.text(
        `Subtotal (${
          registration.totalParticipants
        } peserta): Rp${subtotal.toLocaleString("id-ID")}`
      );
      if (registration.discount_total > 0) {
        doc
          .fillColor("green")
          .text(
            `Total Diskon Referral: - Rp${registration.discount_total.toLocaleString(
              "id-ID"
            )}`
          );
        doc.fillColor("black");
      }
      doc.moveDown(0.5);
      doc
        .fontSize(14)
        .text(
          `TOTAL DIBAYAR: Rp${registration.grand_total.toLocaleString(
            "id-ID"
          )}`,
          { align: "right", underline: true }
        );

      doc.end();
    } catch (error) {
      console.error("Error generating invoice:", error);
      res
        .status(500)
        .json({ success: false, message: "Error generating invoice" });
    }
  }
}

module.exports = RegistrationController;
