const prisma = require("../config/prismaClient");

class ReferralService {
  static async checkReferralCode(referralCode, programId) {
    try {
      const referral = await prisma.referralCode.findFirst({
        where: {
          code: referralCode,
          status: "active",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          program: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      if (referral) {
        if (
          referral.usageLimit !== null &&
          referral.usedCount >= referral.usageLimit
        ) {
          return {
            success: false,
            message: "Kode referral sudah mencapai batas penggunaan maksimal",
          };
        }
      }

      if (!referral) {
        return {
          success: false,
          message: "Kode referral tidak valid atau sudah tidak berlaku",
        };
      }

      if (referral.programId && referral.programId !== programId) {
        return {
          success: false,
          message: "Kode referral tidak berlaku untuk program ini",
        };
      }

      const program = await prisma.program.findUnique({
        where: { id: programId },
      });

      if (!program) {
        return {
          success: false,
          message: "Program tidak ditemukan",
        };
      }

      const programPrice = program.price;
      let discountAmount = 0;

      if (
        referral.discountType === "percentage" ||
        referral.discountType === "percent"
      ) {
        discountAmount = Math.floor(
          (programPrice * referral.discountValue) / 100
        );
      } else if (referral.discountType === "fixed") {
        discountAmount = referral.discountValue;
      }

      discountAmount = Math.min(discountAmount, programPrice);

      return {
        success: true,
        message: "Kode referral valid",
        data: {
          referral_id: referral.id,
          code: referral.code,
          discount_type: referral.discountType,
          discount_value: referral.discountValue,
          discount_amount: discountAmount,
          referrer_name: null,
          description: referral.description,
        },
      };
    } catch (error) {
      console.error("Error in checkReferralCode:", error);
      throw new Error("Gagal mengecek kode referral");
    }
  }

  static async useReferralCode(referralCode) {
    try {
      await prisma.referralCode.update({
        where: { code: referralCode },
        data: {
          usedCount: { increment: 1 },
        },
      });

      return {
        success: true,
        message: "Kode referral berhasil digunakan",
      };
    } catch (error) {
      console.error("Error in useReferralCode:", error);
      throw new Error("Gagal mengupdate penggunaan kode referral");
    }
  }

  static async getReferralUsage(referralCode) {
    try {
      const usageHistory = await prisma.referralUsageHistory.findMany({
        where: { referralCode },
        include: {
          referral: {
            select: {
              id: true,
              code: true,
              discountType: true,
              discountValue: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const enrichedHistory = [];

      for (const history of usageHistory) {
        const registration = await prisma.registration.findUnique({
          where: { id: history.registrationId },
          include: {
            program: {
              select: { title: true },
            },
            participants: {
              where: { referralCode: referralCode },
              select: { name: true },
            },
          },
        });

        enrichedHistory.push({
          ...history,
          user_name: registration?.participants[0]?.name || null,
          program_title: registration?.program?.title || null,
        });
      }

      return {
        success: true,
        data: enrichedHistory,
      };
    } catch (error) {
      console.error("Error in getReferralUsage:", error);
      throw new Error("Gagal mengambil riwayat penggunaan referral");
    }
  }

  static async createReferralCode(referralData) {
    try {
      const {
        code,
        discountType,
        discountValue,
        programId = null,
        usageLimit = null,
        description = null,
        expiresAt = null,
      } = referralData;

      const existingCode = await prisma.referralCode.findUnique({
        where: { code },
      });

      if (existingCode) {
        return {
          success: false,
          message: "Kode referral sudah ada",
        };
      }

      const referralCode = await prisma.referralCode.create({
        data: {
          code,
          discountType,
          discountValue,
          programId,
          usageLimit,
          description,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      });

      return {
        success: true,
        message: "Kode referral berhasil dibuat",
        data: referralCode,
      };
    } catch (error) {
      throw new Error("Gagal membuat kode referral");
    }
  }

  static async updateReferralCode(codeId, updateData) {
    try {
      const referralCode = await prisma.referralCode.update({
        where: { id: codeId },
        data: {
          ...updateData,
          expiresAt: updateData.expiresAt
            ? new Date(updateData.expiresAt)
            : undefined,
        },
      });

      return {
        success: true,
        message: "kode referral code berhasil di update",
        data: referralCode,
      };
    } catch (error) {
      throw new Error("Gagal mengupdate kode referral");
    }
  }

  static async getAllReferralCodes(filters = {}) {
    try {
      const whereClause = {};

      if (filters.status) {
        whereClause.status = filters.status;
      }

      if (filters.programId) {
        whereClause.programId = parseInt(filters.programId);
      }

      if (filters.isActive !== undefined) {
        whereClause.isActive = filters.isActive;
      }

      const referralCodes = await prisma.referralCode.findMany({
        where: whereClause,
        include: {
          program: {
            select: {
              id: true,
              title: true,
            },
          },
          usageHistory: {
            select: {
              id: true,
              discountAmount: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          _count: {
            select: {
              usageHistory: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const referralCodesWithUsage = referralCodes.map((referralCode) => {
        const usageHistory = referralCode.usageHistory;

        const totalMonetaryUsage = usageHistory.reduce((sum, usage) => {
          return sum + (usage.discountAmount || 0);
        }, 0);

        const averageDiscount =
          usageHistory.length > 0
            ? totalMonetaryUsage / usageHistory.length
            : 0;

        const lastUsedAt =
          usageHistory.length > 0 ? usageHistory[0].createdAt : null;

        const currentPotentialValue =
          referralCode.discountType === "fixed"
            ? referralCode.discountValue
            : null;

        const actualUsageCount = referralCode._count.usageHistory;
        const countDiscrepancy = referralCode.usedCount !== actualUsageCount;

        const { usageHistory: _, _count, ...referralCodeData } = referralCode;

        return {
          ...referralCodeData,
          totalMonetaryUsage,
          averageDiscount: Math.round(averageDiscount),

          actualUsageCount,
          recordedUsageCount: referralCode.usedCount,
          countDiscrepancy,
          lastUsedAt,

          usageRate: referralCode.usageLimit
            ? (actualUsageCount / referralCode.usageLimit) * 100
            : null,
          remainingUses: referralCode.usageLimit
            ? Math.max(0, referralCode.usageLimit - actualUsageCount)
            : null,

          ...(referralCode.discountType === "fixed" && {
            projectedTotalValue: referralCode.usageLimit
              ? referralCode.usageLimit * referralCode.discountValue
              : null,
            valueUtilization:
              referralCode.usageLimit && currentPotentialValue
                ? (totalMonetaryUsage /
                    (referralCode.usageLimit * currentPotentialValue)) *
                  100
                : null,
          }),
        };
      });

      const summary = {
        totalCodes: referralCodesWithUsage.length,
        activeCodes: referralCodesWithUsage.filter((code) => code.isActive)
          .length,

        grandTotalMonetaryUsage: referralCodesWithUsage.reduce(
          (sum, code) => sum + code.totalMonetaryUsage,
          0
        ),

        totalActualUsages: referralCodesWithUsage.reduce(
          (sum, code) => sum + code.actualUsageCount,
          0
        ),
        totalRecordedUsages: referralCodesWithUsage.reduce(
          (sum, code) => sum + code.recordedUsageCount,
          0
        ),

        codesWithDiscrepancies: referralCodesWithUsage.filter(
          (code) => code.countDiscrepancy
        ).length,

        byDiscountType: {
          fixed: referralCodesWithUsage.filter(
            (code) => code.discountType === "fixed"
          ).length,
          percentage: referralCodesWithUsage.filter(
            (code) =>
              code.discountType === "percentage" ||
              code.discountType === "percent"
          ).length,
        },

        // // top performers
        // topPerformers: {
        //   byUsage: referralCodesWithUsage
        //     .sort((a, b) => b.actualUsageCount - a.actualUsageCount)
        //     .slice(0, 5)
        //     .map((code) => ({
        //       code: code.code,
        //       usage: code.actualUsageCount,
        //       monetaryValue: code.totalMonetaryUsage,
        //     })),
        //   byValue: referralCodesWithUsage
        //     .sort((a, b) => b.totalMonetaryUsage - a.totalMonetaryUsage)
        //     .slice(0, 5)
        //     .map((code) => ({
        //       code: code.code,
        //       monetaryValue: code.totalMonetaryUsage,
        //       usage: code.actualUsageCount,
        //     })),
        // },
      };

      return {
        success: true,
        data: referralCodesWithUsage,
        summary,
      };
    } catch (error) {
      throw new Error("gagal mengambil data kode referral");
    }
  }

  static async getReferralCodeById(codeId) {
    try {
      const referralCode = await prisma.referralCode.findUnique({
        where: { id: codeId },
        include: {
          program: {
            select: {
              id: true,
              title: true,
            },
          },
          usageHistory: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });

      if (!referralCode) {
        return {
          success: false,
          message: "Kode referral tidak ditemukan",
        };
      }

      return {
        success: true,
        data: referralCode,
      };
    } catch (error) {
      console.error("Error in getReferralCodeById:", error);
      throw new Error("Gagal mengambil data kode referral");
    }
  }

  static async deleteReferralCode(codeId) {
    try {
      const referralCode = await prisma.referralCode.findUnique({
        where: { id: codeId },
        include: {
          usageHistory: {
            take: 1,
          },
        },
      });

      if (!referralCode) {
        return {
          success: false,
          message: "Kode referral tidak ditemukan",
        };
      }

      if (referralCode.usageHistory && referralCode.usageHistory.length > 0) {
        return {
          success: false,
          message:
            "Tidak dapat menghapus kode referral yang sudah pernah digunakan. Gunakan status inactive sebagai gantinya.",
        };
      }

      await prisma.referralCode.delete({
        where: { id: codeId },
      });

      return {
        success: true,
        message: "Kode referral berhasil dihapus",
      };
    } catch (error) {
      console.error("Error in deleteReferralCode:", error);

      if (error.code === "P2003") {
        return {
          success: false,
          message:
            "Tidak dapat menghapus kode referral karena masih ada data terkait. Ubah status menjadi inactive sebagai gantinya.",
        };
      }

      throw new Error("Gagal menghapus kode referral");
    }
  }

  static async getReferralStats(filters = {}) {
    try {
      const whereClause = {};

      if (filters.startDate && filters.endDate) {
        whereClause.createdAt = {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate),
        };
      }

      const totalCodes = await prisma.referralCode.count({
        where: whereClause,
      });

      const activeCodes = await prisma.referralCode.count({
        where: {
          ...whereClause,
          status: "active",
          isActive: true,
        },
      });

      const totalUsage = await prisma.referralUsageHistory.count({
        where:
          filters.startDate && filters.endDate
            ? {
                createdAt: {
                  gte: new Date(filters.startDate),
                  lte: new Date(filters.endDate),
                },
              }
            : undefined,
      });

      const totalDiscountResult = await prisma.referralUsageHistory.aggregate({
        where:
          filters.startDate && filters.endDate
            ? {
                createdAt: {
                  gte: new Date(filters.startDate),
                  lte: new Date(filters.endDate),
                },
              }
            : undefined,
        _sum: { discountAmount: true },
      });

      const totalDiscount = totalDiscountResult._sum.discountAmount || 0;

      const mostUsedCodes = await prisma.referralCode.findMany({
        where: whereClause,
        orderBy: { usedCount: "desc" },
        take: 5,
        select: {
          id: true,
          code: true,
          usedCount: true,
          discountType: true,
          discountValue: true,
        },
      });

      return {
        success: true,
        data: {
          total_codes: totalCodes,
          active_codes: activeCodes,
          total_usage: totalUsage,
          total_discount: totalDiscount,
          most_used_codes: mostUsedCodes,
        },
      };
    } catch (error) {
      console.error("Error in getReferralStats:", error);
      throw new Error("Gagal mengambil statistik referral");
    }
  }

  static async recordReferralUsage(
    referralCodeString,
    registrationId,
    discountAmount
  ) {
    try {
      const referralCode = await prisma.referralCode.findUnique({
        where: { code: referralCodeString },
      });

      if (!referralCode) {
        throw new Error("Referral code not found");
      }

      await prisma.referralUsageHistory.create({
        data: {
          referralCodeId: referralCode.id,
          referralCode: referralCodeString,
          registrationId: registrationId,
          discountAmount: discountAmount,
        },
      });

      return {
        success: true,
        message: "Penggunaan referral berhasil dicatat",
      };
    } catch (error) {
      console.error("Error in recordReferralUsage:", error);
      throw new Error("Gagal mencatat penggunaan referral");
    }
  }
}

module.exports = ReferralService;
