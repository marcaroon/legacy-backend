const ReferralService = require("../services/referralService");

class ReferralController {
  // Check kode referral
  static async checkReferralCode(req, res) {
    try {
      const { referral_code, program_id } = req.body;

      // Validasi input
      if (!referral_code) {
        return res.status(400).json({
          success: false,
          message: "Kode referral harus diisi",
        });
      }

      if (!program_id) {
        return res.status(400).json({
          success: false,
          message: "Program ID harus diisi",
        });
      }

      // Validate program_id is a number
      const programId = parseInt(program_id);
      if (isNaN(programId)) {
        return res.status(400).json({
          success: false,
          message: "Program ID harus berupa angka",
        });
      }

      // Panggil service untuk check referral
      const result = await ReferralService.checkReferralCode(
        referral_code.trim().toUpperCase(),
        programId
      );

      // Return response sesuai hasil dari service
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error in checkReferralCode controller:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengecek kode referral",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // Get referral usage history
  static async getReferralUsage(req, res) {
    try {
      const { referral_code } = req.params;

      if (!referral_code) {
        return res.status(400).json({
          success: false,
          message: "Kode referral harus diisi",
        });
      }

      const result = await ReferralService.getReferralUsage(referral_code);

      return res.status(200).json(result);
    } catch (error) {
      console.error("Error in getReferralUsage controller:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengambil riwayat referral",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // Use referral code (dipanggil saat registrasi berhasil)
  static async useReferralCode(req, res) {
    try {
      const { referral_code } = req.body;

      if (!referral_code) {
        return res.status(400).json({
          success: false,
          message: "Kode referral harus diisi",
        });
      }

      const result = await ReferralService.useReferralCode(referral_code);

      return res.status(200).json(result);
    } catch (error) {
      console.error("Error in useReferralCode controller:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat menggunakan kode referral",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // CREATE REFERRAL CODE - NEW
  static async createReferralCode(req, res) {
    try {
      const {
        code,
        discountType,
        discountValue,
        programId,
        usageLimit,
        description,
        expiresAt,
      } = req.body;

      // Validation
      if (!code || !discountType || discountValue === undefined) {
        return res.status(400).json({
          success: false,
          message: "Code, discountType, dan discountValue harus diisi",
        });
      }

      // Validate discountType
      const validDiscountTypes = ["fixed", "percent", "percentage"];
      if (!validDiscountTypes.includes(discountType)) {
        return res.status(400).json({
          success: false,
          message:
            "discountType harus salah satu dari: fixed, percent, percentage",
        });
      }

      // Validate discountValue
      if (isNaN(discountValue) || discountValue <= 0) {
        return res.status(400).json({
          success: false,
          message: "discountValue harus berupa angka positif",
        });
      }

      // Validate percentage discount
      if (
        (discountType === "percent" || discountType === "percentage") &&
        discountValue > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "discountValue untuk persentase tidak boleh lebih dari 100",
        });
      }

      const referralData = {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: parseInt(discountValue),
        programId: programId ? parseInt(programId) : null,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        description: description ? description.trim() : null,
        expiresAt,
      };

      const result = await ReferralService.createReferralCode(referralData);

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error in createReferralCode controller:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat membuat kode referral",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // GET ALL REFERRAL CODES - UPDATED WITH MONETARY USAGE
  static async getAllReferralCodes(req, res) {
    try {
      const filters = {
        status: req.query.status,
        programId: req.query.program_id
          ? parseInt(req.query.program_id)
          : undefined,
        isActive:
          req.query.active === "true"
            ? true
            : req.query.active === "false"
            ? false
            : undefined,
      };

      // Remove undefined values
      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined || filters[key] === "") {
          delete filters[key];
        }
      });

      const result = await ReferralService.getAllReferralCodes(filters);

      return res.status(200).json({
        ...result,
        filters: filters,
        count: result.data ? result.data.length : 0,
        message: "Referral codes retrieved successfully",
      });
    } catch (error) {
      console.error("Error in getAllReferralCodes controller:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengambil data kode referral",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // GET REFERRAL CODE BY ID - NEW
  static async getReferralCodeById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: "ID referral code harus berupa angka",
        });
      }

      const result = await ReferralService.getReferralCodeById(parseInt(id));

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(404).json(result);
      }
    } catch (error) {
      console.error("Error in getReferralCodeById controller:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengambil data kode referral",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // UPDATE REFERRAL CODE - NEW
  static async updateReferralCode(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: "ID referral code harus berupa angka",
        });
      }

      const updateData = {};
      const allowedFields = [
        "code",
        "discountType",
        "discountValue",
        "programId",
        "usageLimit",
        "description",
        "expiresAt",
        "status",
        "isActive",
      ];

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          if (field === "code" && req.body[field]) {
            updateData[field] = req.body[field].trim().toUpperCase();
          } else if (
            field === "discountValue" ||
            field === "programId" ||
            field === "usageLimit"
          ) {
            updateData[field] = req.body[field]
              ? parseInt(req.body[field])
              : null;
          } else if (field === "isActive") {
            updateData[field] =
              req.body[field] === true || req.body[field] === "true";
          } else {
            updateData[field] = req.body[field];
          }
        }
      });

      // Validate discountType if provided
      if (updateData.discountType) {
        const validDiscountTypes = ["fixed", "percent", "percentage"];
        if (!validDiscountTypes.includes(updateData.discountType)) {
          return res.status(400).json({
            success: false,
            message:
              "discountType harus salah satu dari: fixed, percent, percentage",
          });
        }
      }

      // Validate discountValue if provided
      if (
        updateData.discountValue !== undefined &&
        (isNaN(updateData.discountValue) || updateData.discountValue <= 0)
      ) {
        return res.status(400).json({
          success: false,
          message: "discountValue harus berupa angka positif",
        });
      }

      const result = await ReferralService.updateReferralCode(
        parseInt(id),
        updateData
      );

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(404).json(result);
      }
    } catch (error) {
      console.error("Error in updateReferralCode controller:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengupdate kode referral",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  static async deleteReferralCode(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: "ID referral code harus berupa angka",
        });
      }

      const result = await ReferralService.deleteReferralCode(parseInt(id));

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error in deleteReferralCode controller:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat menghapus kode referral",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  static async getReferralStats(req, res) {
    try {
      const filters = {
        startDate: req.query.start_date,
        endDate: req.query.end_date,
      };

      // Remove null/undefined values
      Object.keys(filters).forEach((key) => {
        if (
          filters[key] === null ||
          filters[key] === undefined ||
          filters[key] === ""
        ) {
          delete filters[key];
        }
      });

      const result = await ReferralService.getReferralStats(filters);

      return res.status(200).json({
        ...result,
        filters: filters,
      });
    } catch (error) {
      console.error("Error in getReferralStats controller:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengambil statistik referral",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
}

module.exports = ReferralController;
