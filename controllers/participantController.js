const participantService = require("../services/participantService");
const ExcelJS = require("exceljs");

class ParticipantController {
  static async getAllParticipants(req, res) {
    try {
      const filters = {
        registration_id: req.query.registration_id,
      };

      Object.keys(filters).forEach((key) => {
        if (!filters[key]) {
          delete filters[key];
        }
      });

      const result = await participantService.getAllParticipants(filters);

      res.json({
        success: true,
        data: result.participants,
        count: result.participants.length,
        totalCount: result.totalCount, // Total keseluruhan
        filters,
        message: "Participants retrieved successfully",
      });
    } catch (error) {
      console.error("Error in getAllParticipants:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve participants",
        error: error.message,
      });
    }
  }

  // GET /api/participants/:id
  static async getParticipantById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Participant ID is required",
        });
      }

      console.log(`Fetching participant with ID: ${id}`);

      const participant = await participantService.getParticipantById(id);

      if (!participant) {
        return res.status(404).json({
          success: false,
          message: "Participant not found",
        });
      }

      res.json({
        success: true,
        data: participant,
        message: "Participant retrieved successfully",
      });
    } catch (error) {
      console.error("Error in getParticipantById:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve participant",
        error: error.message,
      });
    }
  }
  static async exportParticipantsToExcel(req, res) {
    try {
      const filters = {
        registration_id: req.query.registration_id,
      };

      // Hapus nilai kosong/null
      Object.keys(filters).forEach((key) => {
        if (!filters[key]) {
          delete filters[key];
        }
      });

      console.log("Exporting participants with filters:", filters);

      const result = await participantService.getAllParticipants(filters);
      const participants = result.participants;

      // Buat workbook baru
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Participants");

      worksheet.columns = [
        { header: "ID", key: "id", width: 8 },
        { header: "Registration ID", key: "registrationId", width: 20 },
        { header: "Midtrans Order ID", key: "midtransOrderId", width: 25 },
        { header: "Full Name", key: "name", width: 25 },
        { header: "Email", key: "email", width: 30 },
        { header: "Phone", key: "phone", width: 18 },
        { header: "City", key: "city", width: 20 },
        { header: "Referral Code", key: "referralCode", width: 15 },
        { header: "Discount Amount (Rp)", key: "discountAmount", width: 18 },
        { header: "Registration Date", key: "createdAt", width: 20 },
      ];

      // Style header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE6F3FF" },
      };

      participants.forEach((participant) => {
        worksheet.addRow({
          id: participant.id,
          registrationId: participant.registration?.registrationId || "-",
          midtransOrderId: participant.registration?.midtransOrderId || "-",
          name: participant.name,
          email: participant.email,
          phone: participant.phone,
          city: participant.city || "-",
          referralCode: participant.referralCode || "-",
          discountAmount: participant.discountAmount || 0,
          createdAt: new Date(participant.createdAt).toLocaleString("id-ID"),
        });
      });

      // Format currency column
      const discountColumn = worksheet.getColumn("discountAmount");
      discountColumn.numFmt = "#,##0";

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        if (column.width < 10) column.width = 10;
      });

      // Set response headers
      const fileName = `participants_${
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
      console.error("Error exporting participants to Excel:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export participants to Excel",
        error: error.message,
      });
    }
  }
}

module.exports = ParticipantController;
