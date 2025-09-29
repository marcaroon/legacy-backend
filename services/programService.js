const prisma = require("../config/prismaClient");

class ProgramService {
  static async getAllPrograms(filters = {}) {
    try {
      const whereClause = {
        // isActive: true, // cuma nampilin program aktif
      };

      if (filters.search) {
        whereClause.OR = [
          { title: { contains: filters.search } },
          { description: { contains: filters.search } },
        ];
      }

      const queryOptions = {
        where: whereClause,
        orderBy: [{ id: "asc" }],
        include: {
          registrations: {
            select: {
              id: true,
              paymentStatus: true,
              totalAmount: true,
              usedEarlyBird: true,
              createdAt: true,
            },
          },
          referralCodes: {
            where: { isActive: true },
            select: {
              id: true,
            },
          },
        },
      };

      if (filters.page && filters.limit) {
        const skip = (parseInt(filters.page) - 1) * parseInt(filters.limit);
        queryOptions.skip = skip;
        queryOptions.take = parseInt(filters.limit);
      } else if (filters.limit) {
        queryOptions.take = parseInt(filters.limit);
      }

      let programs = await prisma.program.findMany(queryOptions);

      programs = programs.map((program) => this.addComputedFields(program));

      const summary = {
        totalPrograms: programs.length,
        // activePrograms: programs.filter((p) => p.isActive).length,
        // programsWithEarlyBird: programs.filter((p) => p.earlyBirdPrice).length,
        // activeEarlyBirdPrograms: programs.filter((p) => p.isEarlyBirdActive)
        //   .length,

        totalRegistrations: programs.reduce(
          (sum, p) => sum + (p.registrations?.length || 0),
          0
        ),
        paidRegistrations: programs.reduce(
          (sum, p) =>
            sum +
            (p.registrations?.filter((r) => r.paymentStatus === "paid")
              .length || 0),
          0
        ),
        pendingRegistrations: programs.reduce(
          (sum, p) =>
            sum +
            (p.registrations?.filter((r) => r.paymentStatus === "pending")
              .length || 0),
          0
        ),

        totalRevenue: programs.reduce((sum, p) => {
          const paidRegs =
            p.registrations?.filter((r) => r.paymentStatus === "paid") || [];
          return (
            sum +
            paidRegs.reduce((regSum, r) => regSum + (r.totalAmount || 0), 0)
          );
        }, 0),

        earlyBirdUsageCount: programs.reduce(
          (sum, p) =>
            sum +
            (p.registrations?.filter((r) => r.usedEarlyBird === true).length ||
              0),
          0
        ),

        // priceRange: {
        //   min: Math.min(...programs.map((p) => p.currentPrice)),
        //   max: Math.max(...programs.map((p) => p.currentPrice)),
        //   average: Math.round(
        //     programs.reduce((sum, p) => sum + p.currentPrice, 0) /
        //       programs.length
        //   ),
        // },

        // topPerformers: {
        //   byRegistrations: programs
        //     .sort(
        //       (a, b) =>
        //         (b.registrations?.length || 0) - (a.registrations?.length || 0)
        //     )
        //     .slice(0, 3)
        //     .map((p) => ({
        //       id: p.id,
        //       title: p.title,
        //       registrations: p.registrations?.length || 0,
        //       revenue: (
        //         p.registrations?.filter((r) => r.paymentStatus === "paid") || []
        //       ).reduce((sum, r) => sum + (r.totalAmount || 0), 0),
        //     })),
        //   byRevenue: programs
        //     .map((p) => ({
        //       id: p.id,
        //       title: p.title,
        //       registrations: p.registrations?.length || 0,
        //       revenue: (
        //         p.registrations?.filter((r) => r.paymentStatus === "paid") || []
        //       ).reduce((sum, r) => sum + (r.totalAmount || 0), 0),
        //     }))
        //     .sort((a, b) => b.revenue - a.revenue)
        //     .slice(0, 3),
        // },
      };

      // if (summary.totalRegistrations > 0) {
      //   summary.conversionRate = Math.round(
      //     (summary.paidRegistrations / summary.totalRegistrations) * 100
      //   );
      // } else {
      //   summary.conversionRate = 0;
      // }

      if (summary.totalRegistrations > 0) {
        summary.earlyBirdUsageRate = Math.round(
          (summary.earlyBirdUsageCount / summary.totalRegistrations) * 100
        );
      } else {
        summary.earlyBirdUsageRate = 0;
      }

      const transformedPrograms = programs.map((program) => {
        if (filters.includeStats) {
          const paidRegistrations =
            program.registrations?.filter((r) => r.paymentStatus === "paid") ||
            [];
          return {
            ...program,
            total_registrations: program.registrations?.length || 0,
            paid_registrations: paidRegistrations.length,
            revenue: paidRegistrations.reduce(
              (sum, r) => sum + (r.totalAmount || 0),
              0
            ),
            registrations: undefined,
            referralCodes: undefined,
          };
        } else {
          const { registrations, referralCodes, ...cleanProgram } = program;
          return cleanProgram;
        }
      });

      return {
        programs: transformedPrograms,
        summary: summary,
      };
    } catch (error) {
      console.error("Error fetching programs:", error);
      throw new Error(`Error fetching programs: ${error.message}`);
    }
  }

  static async getProgramById(id, includeStats = false) {
    try {
      const queryOptions = {
        where: {
          id: parseInt(id),
          isActive: true,
        },
      };

      if (includeStats) {
        queryOptions.include = {
          registrations: {
            select: {
              id: true,
              paymentStatus: true,
              totalAmount: true,
              usedEarlyBird: true,
              createdAt: true,
            },
          },
          referralCodes: {
            where: { isActive: true },
            select: {
              id: true,
              code: true,
              discountType: true,
              discountValue: true,
              usedCount: true,
            },
          },
        };
      }

      let program = await prisma.program.findFirst(queryOptions);

      if (!program) {
        return null;
      }

      program = this.addComputedFields(program);

      if (includeStats && program.registrations) {
        const paidRegistrations = program.registrations.filter(
          (r) => r.paymentStatus === "paid"
        );
        const earlyBirdUsage = program.registrations.filter(
          (r) => r.usedEarlyBird === true
        );
        const totalRevenue = paidRegistrations.reduce(
          (sum, r) => sum + r.totalAmount,
          0
        );

        return {
          ...program,
          stats: {
            total_registrations: program.registrations.length,
            paid_registrations: paidRegistrations.length,
            pending_registrations: program.registrations.filter(
              (r) => r.paymentStatus === "pending"
            ).length,
            failed_registrations: program.registrations.filter(
              (r) => r.paymentStatus === "failed"
            ).length,
            early_bird_usage: earlyBirdUsage.length,
            total_revenue: totalRevenue,
            active_referral_codes: program.referralCodes?.length || 0,
          },
          registrations: undefined,
          referralCodes: program.referralCodes,
        };
      }

      return program;
    } catch (error) {
      console.error("Error fetching program:", error);
      throw new Error(`Error fetching program: ${error.message}`);
    }
  }

  static addComputedFields(program) {
    const now = new Date();

    const isEarlyBirdActive =
      program.earlyBirdEndDate &&
      program.earlyBirdPrice &&
      now <= new Date(program.earlyBirdEndDate);

    const currentPrice = isEarlyBirdActive
      ? program.earlyBirdPrice
      : program.price;

    const savings = isEarlyBirdActive
      ? program.price - program.earlyBirdPrice
      : 0;

    let earlyBirdDaysLeft = null;
    if (program.earlyBirdEndDate && isEarlyBirdActive) {
      const timeDiff =
        new Date(program.earlyBirdEndDate).getTime() - now.getTime();
      earlyBirdDaysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
    }

    return {
      ...program,
      isEarlyBirdActive,
      currentPrice,
      savings,
      earlyBirdDaysLeft,
      earlyBirdPrice: program.earlyBirdPrice || program.price,
      normalPrice: program.price,
    };
  }

  static async createProgram(programData) {
    try {
      const {
        title,
        duration,
        price,
        earlyBirdPrice,
        earlyBirdEndDate,
        description,
      } = programData;

      if (!title || !duration || price === undefined) {
        throw new Error("Title, duration, and price are required");
      }

      if (price < 0) {
        throw new Error("Price must be a positive number");
      }

      if (earlyBirdPrice !== undefined) {
        if (earlyBirdPrice < 0) {
          throw new Error("Early bird price must be a positive number");
        }
        if (earlyBirdPrice >= price) {
          throw new Error("Early bird price must be less than regular price");
        }
        if (!earlyBirdEndDate) {
          throw new Error(
            "Early bird end date is required when early bird price is set"
          );
        }
      }

      if (earlyBirdEndDate) {
        const endDate = new Date(earlyBirdEndDate);
        if (endDate <= new Date()) {
          throw new Error("Early bird end date must be in the future");
        }
      }

      const program = await prisma.program.create({
        data: {
          title: title.trim(),
          duration: duration.trim(),
          price: parseInt(price),
          earlyBirdPrice: earlyBirdPrice ? parseInt(earlyBirdPrice) : null,
          earlyBirdEndDate: earlyBirdEndDate
            ? new Date(earlyBirdEndDate)
            : null,
          description: description ? description.trim() : null,
        },
      });

      return program.id;
    } catch (error) {
      console.error("Error creating program:", error);
      throw new Error(`Error creating program: ${error.message}`);
    }
  }

  static async updateProgram(id, programData) {
    try {
      const existingProgram = await prisma.program.findUnique({
        where: { id: parseInt(id) },
      });

      if (!existingProgram) {
        throw new Error("Program not found");
      }

      const updateData = {};

      if (programData.title !== undefined) {
        updateData.title = programData.title.trim();
      }

      if (programData.duration !== undefined) {
        updateData.duration = programData.duration.trim();
      }

      if (programData.price !== undefined) {
        if (programData.price < 0) {
          throw new Error("Price must be a positive number");
        }
        updateData.price = parseInt(programData.price);
      }

      if (programData.earlyBirdPrice !== undefined) {
        if (programData.earlyBirdPrice !== null) {
          if (programData.earlyBirdPrice < 0) {
            throw new Error("Early bird price must be a positive number");
          }
          const regularPrice = programData.price ?? existingProgram.price;
          if (programData.earlyBirdPrice >= regularPrice) {
            throw new Error("Early bird price must be less than regular price");
          }
          updateData.earlyBirdPrice = parseInt(programData.earlyBirdPrice);
        } else {
          updateData.earlyBirdPrice = null;
        }
      }

      if (programData.earlyBirdEndDate !== undefined) {
        if (programData.earlyBirdEndDate) {
          const endDate = new Date(programData.earlyBirdEndDate);
          if (endDate <= new Date()) {
            throw new Error("Early bird end date must be in the future");
          }
          updateData.earlyBirdEndDate = endDate;
        } else {
          updateData.earlyBirdEndDate = null;
        }
      }

      if (programData.description !== undefined) {
        updateData.description = programData.description
          ? programData.description.trim()
          : null;
      }

      if (programData.isActive !== undefined) {
        updateData.isActive = Boolean(programData.isActive);
      }

      const updatedProgram = await prisma.program.update({
        where: { id: parseInt(id) },
        data: updateData,
      });

      return this.addComputedFields(updatedProgram);
    } catch (error) {
      console.error("Error updating program:", error);
      throw new Error(`Error updating program: ${error.message}`);
    }
  }

  static async getCurrentPrice(programId) {
    try {
      const program = await this.getProgramById(programId);
      if (!program) {
        throw new Error("Program not found");
      }

      return {
        programId: program.id,
        title: program.title,
        regularPrice: program.price,
        earlyBirdPrice: program.earlyBirdPrice,
        currentPrice: program.currentPrice,
        isEarlyBirdActive: program.isEarlyBirdActive,
        savings: program.savings,
        earlyBirdDaysLeft: program.earlyBirdDaysLeft,
        earlyBirdEndDate: program.earlyBirdEndDate,
      };
    } catch (error) {
      console.error("Error getting current price:", error);
      throw new Error(`Error getting current price: ${error.message}`);
    }
  }

  static async deleteProgram(id) {
    try {
      const existingProgram = await prisma.program.findUnique({
        where: { id: parseInt(id) },
        include: {
          registrations: {
            select: { id: true },
          },
        },
      });

      if (!existingProgram) {
        throw new Error("Program not found");
      }

      if (existingProgram.registrations.length > 0) {
        await prisma.program.update({
          where: { id: parseInt(id) },
          data: { isActive: false },
        });
        return { softDeleted: true };
      } else {
        await prisma.program.delete({
          where: { id: parseInt(id) },
        });
        return { hardDeleted: true };
      }
    } catch (error) {
      console.error("Error deleting program:", error);
      throw new Error(`Error deleting program: ${error.message}`);
    }
  }

  static async getProgramStats(filters = {}) {
    try {
      const whereClause = {
        isActive: true,
      };

      if (filters.startDate && filters.endDate) {
        whereClause.createdAt = {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate),
        };
      }

      if (filters.programId) {
        whereClause.id = parseInt(filters.programId, 10);
      }

      const programsWithRegistrations = await prisma.program.findMany({
        where: whereClause,
        include: {
          registrations: {
            select: {
              id: true,
              paymentStatus: true,
              totalAmount: true,
              usedEarlyBird: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const programStats = programsWithRegistrations.map((program) => {
        const paidRegistrations = program.registrations.filter(
          (r) => r.paymentStatus === "paid"
        );
        const earlyBirdUsage = program.registrations.filter(
          (r) => r.usedEarlyBird === true
        );
        const totalRevenue = paidRegistrations.reduce(
          (sum, r) => sum + r.totalAmount,
          0
        );

        const enhancedProgram = this.addComputedFields(program);

        return {
          id: program.id,
          title: program.title,
          price: program.price,
          earlyBirdPrice: program.earlyBirdPrice,
          isEarlyBirdActive: enhancedProgram.isEarlyBirdActive,
          currentPrice: enhancedProgram.currentPrice,
          savings: enhancedProgram.savings,
          total_registrations: program.registrations.length,
          paid_registrations: paidRegistrations.length,
          early_bird_usage: earlyBirdUsage.length,
          total_revenue: totalRevenue,
          conversion_rate:
            program.registrations.length > 0
              ? (
                  (paidRegistrations.length / program.registrations.length) *
                  100
                ).toFixed(2)
              : 0,
        };
      });

      programStats.sort(
        (a, b) => b.total_registrations - a.total_registrations
      );

      const totalRegistrations = programStats.reduce(
        (sum, p) => sum + p.total_registrations,
        0
      );
      const totalRevenue = programStats.reduce(
        (sum, p) => sum + p.total_revenue,
        0
      );
      const totalPaidRegistrations = programStats.reduce(
        (sum, p) => sum + p.paid_registrations,
        0
      );
      const totalEarlyBirdUsage = programStats.reduce(
        (sum, p) => sum + p.early_bird_usage,
        0
      );

      return {
        total_programs: programStats.length,
        total_registrations: totalRegistrations,
        total_paid_registrations: totalPaidRegistrations,
        total_early_bird_usage: totalEarlyBirdUsage,
        early_bird_conversion_rate:
          totalRegistrations > 0
            ? ((totalEarlyBirdUsage / totalRegistrations) * 100).toFixed(2)
            : 0,
        total_revenue: totalRevenue,
        overall_conversion_rate:
          totalRegistrations > 0
            ? ((totalPaidRegistrations / totalRegistrations) * 100).toFixed(2)
            : 0,
        program_details: programStats.slice(0, 10),
        top_revenue_programs: [...programStats]
          .sort((a, b) => b.total_revenue - a.total_revenue)
          .slice(0, 5),
      };
    } catch (error) {
      console.error("Error fetching program stats:", error);
      throw new Error(`Error fetching program stats: ${error.message}`);
    }
  }

  static async searchPrograms(searchTerm, filters = {}) {
    try {
      const whereClause = {
        isActive: true,
        OR: [
          { title: { contains: searchTerm, mode: "insensitive" } },
          { description: { contains: searchTerm, mode: "insensitive" } },
        ],
      };

      if (filters.minPrice) {
        whereClause.price = { gte: parseInt(filters.minPrice) };
      }

      if (filters.maxPrice) {
        whereClause.price = whereClause.price
          ? { ...whereClause.price, lte: parseInt(filters.maxPrice) }
          : { lte: parseInt(filters.maxPrice) };
      }

      const programs = await prisma.program.findMany({
        where: whereClause,
        orderBy: [{ createdAt: "desc" }],
        take: filters.limit ? parseInt(filters.limit) : 20,
      });

      return programs.map((program) => this.addComputedFields(program));
    } catch (error) {
      console.error("Error searching programs:", error);
      throw new Error(`Error searching programs: ${error.message}`);
    }
  }

  // Duplicate program with early bird support
  static async duplicateProgram(id, newTitle = null) {
    try {
      const originalProgram = await prisma.program.findUnique({
        where: { id: parseInt(id) },
      });

      if (!originalProgram) {
        throw new Error("Program not found");
      }

      const duplicatedProgram = await prisma.program.create({
        data: {
          title: newTitle || `${originalProgram.title} (Copy)`,
          duration: originalProgram.duration,
          price: originalProgram.price,
          earlyBirdPrice: originalProgram.earlyBirdPrice,
          earlyBirdEndDate: originalProgram.earlyBirdEndDate,
          description: originalProgram.description,
        },
      });

      return this.addComputedFields(duplicatedProgram);
    } catch (error) {
      console.error("Error duplicating program:", error);
      throw new Error(`Error duplicating program: ${error.message}`);
    }
  }
}

module.exports = ProgramService;
