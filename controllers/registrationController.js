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
          if (!participant.city || !participant.city.trim()) {
            validationErrors.push(`participant[${index}].city is required`);
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
          city: p.city.trim(),
          referral_code: p.referral_code
            ? p.referral_code.trim().toUpperCase()
            : null,
          discount_amount: p.discount_amount || 0,
        })),
      };

      // console.log(
      //   "Cleaned registration data:",
      //   JSON.stringify(cleanedData, null, 2)
      // );

      const result = await registrationService.createRegistration(cleanedData);

      // console.log("Registration created successfully:", result);

      res.status(201).json({
        success: true,
        data: result,
        message: "Registration created successfully",
      });
    } catch (error) {
      console.error("Error in createRegistration:", error);

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

  static async createBankTransferRegistration(req, res) {
    try {
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
          if (!participant.city || !participant.city.trim()) {
            validationErrors.push(`participant[${index}].city is required`);
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
          city: p.city.trim(),
          referral_code: p.referral_code
            ? p.referral_code.trim().toUpperCase()
            : null,
          discount_amount: p.discount_amount || 0,
        })),
      };

      const result = await registrationService.createBankTransferRegistration(
        cleanedData
      );

      res.status(201).json({
        success: true,
        data: result,
        message: "Bank transfer registration created successfully",
      });
    } catch (error) {
      console.error("Error in createBankTransferRegistration:", error);

      let statusCode = 500;
      let message = "Failed to create bank transfer registration";

      if (
        error.message.includes("Program tidak ditemukan") ||
        error.message.includes("Program not found")
      ) {
        statusCode = 404;
        message = "Program not found";
      }

      res.status(statusCode).json({
        success: false,
        message: message,
        error: error.message,
      });
    }
  }

  static async uploadTransferProof(req, res) {
    try {
      const { registrationId } = req.params;

      // validasi file
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      // cek apakah registrasi ada
      const registration = await registrationService.getRegistrationById(
        registrationId
      );

      if (!registration) {
        // hapus file yang sudah diupload
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: "Registration not found",
        });
      }

      // cek apakah payment method adalah bank_transfer
      if (registration.paymentMethod !== "bank_transfer") {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message:
            "This registration does not use bank transfer payment method",
        });
      }
      const baseUrl =
        process.env.API_BASE_URL ||
        `http://localhost:${process.env.PORT || 5000}/api`;
      const proofUrl = `${baseUrl}/uploads/transfer-proofs/${req.file.filename}`;

      // hapus file lama jika ada
      if (registration.bankTransferProof) {
        try {
          const oldFilename = path.basename(registration.bankTransferProof);
          const oldFilePath = path.join(
            __dirname,
            "../uploads/transfer-proofs",
            oldFilename
          );
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        } catch (error) {
          console.error("Error deleting old file:", error);
        }
      }

      // update database
      const updatedRegistration = await registrationService.uploadTransferProof(
        registrationId,
        proofUrl
      );

      res.json({
        success: true,
        data: {
          registration_id: updatedRegistration.registrationId,
          proof_url: proofUrl,
          uploaded_at: new Date(),
        },
        message: "Transfer proof uploaded successfully",
      });
    } catch (error) {
      // hapus file jika terjadi error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.error("Error uploading transfer proof:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload transfer proof",
        error: error.message,
      });
    }
  }

  static async verifyBankTransfer(req, res) {
    try {
      const { registrationId } = req.params;
      const { verified } = req.body;

      if (typeof verified !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "verified must be a boolean",
        });
      }

      // cek registrasi
      const registration = await registrationService.getRegistrationById(
        registrationId
      );

      if (!registration) {
        return res.status(404).json({
          success: false,
          message: "Registration not found",
        });
      }

      // cek apakah sudah upload bukti
      if (!registration.bankTransferProof) {
        return res.status(400).json({
          success: false,
          message: "No transfer proof uploaded yet",
        });
      }

      const updatedRegistration = await registrationService.verifyBankTransfer(
        registrationId,
        verified
      );

      res.json({
        success: true,
        data: {
          registration_id: updatedRegistration.registrationId,
          payment_status: updatedRegistration.paymentStatus,
          verified_at: verified ? new Date() : null,
        },
        message: verified
          ? "Bank transfer verified successfully"
          : "Bank transfer rejected",
      });
    } catch (error) {
      console.error("Error verifying bank transfer:", error);
      res.status(500).json({
        success: false,
        message: "Failed to verify bank transfer",
        error: error.message,
      });
    }
  }

  static async getTransferProof(req, res) {
    try {
      const { registrationId } = req.params;

      const registration = await registrationService.getRegistrationById(
        registrationId
      );

      if (!registration || !registration.bankTransferProof) {
        return res.status(404).json({
          success: false,
          message: "Transfer proof not found",
        });
      }

      const filename = path.basename(registration.bankTransferProof);
      const filePath = path.join(
        __dirname,
        "../uploads/transfer-proofs",
        filename
      );

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: "File not found on server",
        });
      }

      res.sendFile(filePath);
    } catch (error) {
      console.error("Error getting transfer proof:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get transfer proof",
        error: error.message,
      });
    }
  }

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

  static async getRegistrationStats(req, res) {
    try {
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date,
      };

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

  static async handlePaymentNotification(req, res) {
    try {
      // console.log("=== PAYMENT NOTIFICATION RECEIVED ===");
      // console.log("Headers:", req.headers);
      // console.log("Body:", JSON.stringify(req.body, null, 2));

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

      // console.log("Payment notification processed successfully:", result);

      res.status(200).json({
        success: true,
        message: "OK",
      });
    } catch (error) {
      console.error("Error in handlePaymentNotification:", error);

      res.status(200).json({
        success: false,
        message: "Notification processed with error",
        error: error.message,
      });
    }
  }

  static async getPaymentStatus(req, res) {
    try {
      const { registrationId } = req.params;

      if (!registrationId) {
        return res.status(400).json({
          success: false,
          message: "Registration ID is required",
        });
      }

      // console.log(`Checking payment status for: ${registrationId}`);

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

  static async checkPaymentStatus(req, res) {
    try {
      const { registrationId } = req.params;

      if (!registrationId) {
        return res.status(400).json({
          success: false,
          message: "Registration ID is required",
        });
      }

      // console.log(
      //   `Syncing payment status with Midtrans for: ${registrationId}`
      // );

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

  static async cancelRegistration(req, res) {
    try {
      const { registrationId } = req.params;

      if (!registrationId) {
        return res.status(400).json({
          success: false,
          message: "Registration ID is required",
        });
      }

      // console.log(`Cancelling registration: ${registrationId}`);

      const registration = await registrationService.getRegistrationById(
        registrationId
      );

      if (!registration) {
        return res.status(404).json({
          success: false,
          message: "Registration not found",
        });
      }

      if (registration.paymentStatus === "paid") {
        return res.status(400).json({
          success: false,
          message: "Cannot cancel paid registration",
        });
      }

      let result = { success: true };

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

      Object.keys(filters).forEach((key) => {
        if (
          filters[key] === null ||
          filters[key] === undefined ||
          filters[key] === ""
        ) {
          delete filters[key];
        }
      });

      // console.log("Exporting registrations with filters:", filters);

      const registrations = await registrationService.getAllRegistrations(
        filters
      );

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Registrations");

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

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE6F3FF" },
      };

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

      const amountColumn = worksheet.getColumn("totalAmount");
      amountColumn.numFmt = "#,##0";

      worksheet.columns.forEach((column) => {
        if (column.width < 10) column.width = 10;
      });

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

      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=INVOICE-${registrationId}.pdf`
      );

      doc.pipe(res);

      const path = require("path");
      const fs = require("fs");
      const logoPath = path.join(__dirname, "../assets/legacy-logo.png");

      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 80 });
      }

      doc
        .fontSize(10)
        .fillColor("#333333")
        .text("Legacy", 400, 50, { align: "right" })
        .text("Surabaya, Indonesia", { align: "right" })
        .text("Email: legacy@tq-official.com", { align: "right" })
        .text("Phone: +62 815 1530 0511", { align: "right" });

      doc
        .fontSize(28)
        .fillColor("#1a1a1a")
        .text("INVOICE", 50, 140, { align: "left" });

      doc
        .fontSize(10)
        .fillColor("#666666")
        .text(`Invoice Number: ${registration.registrationId}`, 50, 180);

      if (registration.paidAt) {
        doc.text(
          `Payment Date: ${new Date(registration.paidAt).toLocaleDateString(
            "id-ID",
            {
              day: "numeric",
              month: "long",
              year: "numeric",
            }
          )}`
        );
      }

      doc.text(
        `Invoice Date: ${new Date(registration.createdAt).toLocaleDateString(
          "id-ID",
          {
            day: "numeric",
            month: "long",
            year: "numeric",
          }
        )}`
      );

      const statusY = 180;
      const statusColors = {
        paid: "#10b981",
        pending: "#f59e0b",
        failed: "#ef4444",
        cancelled: "#6b7280",
      };

      const statusColor = statusColors[registration.paymentStatus] || "#6b7280";
      const statusText = registration.paymentStatus.toUpperCase();

      doc
        .roundedRect(400, statusY, 120, 25, 3)
        .fillAndStroke(statusColor, statusColor);

      doc
        .fontSize(10)
        .fillColor("#ffffff")
        .text(statusText, 400, statusY + 7, {
          width: 120,
          align: "center",
        });

      doc
        .strokeColor("#e5e7eb")
        .lineWidth(1)
        .moveTo(50, 230)
        .lineTo(545, 230)
        .stroke();

      doc.fontSize(12).fillColor("#1a1a1a").text("BILL TO", 50, 250);

      doc
        .fontSize(10)
        .fillColor("#333333")
        .text(registration.contactName, 50, 270)
        .text(registration.contactEmail, 50, 285)
        .text(registration.contactPhone, 50, 300);

      doc.fontSize(12).fillColor("#1a1a1a").text("PROGRAM DETAILS", 320, 250);

      doc
        .fontSize(10)
        .fillColor("#333333")
        .text(registration.program_title, 320, 270)
        .text(`Duration: ${registration.duration}`, 320, 285)
        .text(`Participants: ${registration.totalParticipants}`, 320, 300);

      const tableTop = 350;
      doc
        .strokeColor("#e5e7eb")
        .lineWidth(1)
        .moveTo(50, tableTop)
        .lineTo(545, tableTop)
        .stroke();

      doc.rect(50, tableTop + 5, 495, 25).fillAndStroke("#f3f4f6", "#e5e7eb");

      doc
        .fontSize(10)
        .fillColor("#1a1a1a")
        .text("DESCRIPTION", 60, tableTop + 13)
        .text("QTY", 350, tableTop + 13)
        .text("UNIT PRICE", 400, tableTop + 13)
        .text("AMOUNT", 480, tableTop + 13);

      let yPosition = tableTop + 40;

      registration.participants.forEach((participant, index) => {
        const pricePerParticipant = registration.actual_price_per_participant;
        const discount = participant.discountAmount || 0;
        const amount = pricePerParticipant - discount;

        doc
          .fontSize(9)
          .fillColor("#333333")
          .text(`Participant ${index + 1}`, 60, yPosition)
          .text(participant.name, 60, yPosition + 12, { width: 250 });

        doc
          .text("1", 350, yPosition + 6)
          .text(
            `Rp ${pricePerParticipant.toLocaleString("id-ID")}`,
            380,
            yPosition + 6,
            { width: 80, align: "right" }
          )
          .text(
            `Rp ${pricePerParticipant.toLocaleString("id-ID")}`,
            460,
            yPosition + 6,
            { width: 80, align: "right" }
          );

        yPosition += 30;

        if (discount > 0) {
          doc
            .fillColor("#10b981")
            .text(
              `Referral Discount (${participant.referralCode})`,
              60,
              yPosition
            )
            .text("1", 350, yPosition)
            .text(`-Rp ${discount.toLocaleString("id-ID")}`, 380, yPosition, {
              width: 80,
              align: "right",
            })
            .text(`-Rp ${discount.toLocaleString("id-ID")}`, 460, yPosition, {
              width: 80,
              align: "right",
            });

          yPosition += 25;
        }

        if (index < registration.participants.length - 1) {
          doc
            .strokeColor("#f3f4f6")
            .lineWidth(1)
            .moveTo(50, yPosition)
            .lineTo(545, yPosition)
            .stroke();
          yPosition += 10;
        }
      });

      yPosition += 20;

      doc
        .strokeColor("#e5e7eb")
        .lineWidth(1)
        .moveTo(50, yPosition)
        .lineTo(545, yPosition)
        .stroke();

      yPosition += 20;

      const subtotal =
        registration.totalParticipants *
        registration.actual_price_per_participant;
      const totalDiscount = registration.discount_total || 0;
      const subtotalAfterDiscount = subtotal - totalDiscount;
      const ppn = Math.round(subtotalAfterDiscount * 0.11);
      const grandTotal = registration.grand_total;

      doc
        .fontSize(10)
        .fillColor("#666666")
        .text("Subtotal:", 380, yPosition, { width: 80, align: "right" })
        .fillColor("#333333")
        .text(`Rp ${subtotal.toLocaleString("id-ID")}`, 460, yPosition, {
          width: 80,
          align: "right",
        });

      yPosition += 20;

      if (totalDiscount > 0) {
        doc
          .fillColor("#666666")
          .text("Total Discount:", 380, yPosition, {
            width: 80,
            align: "right",
          })
          .fillColor("#10b981")
          .text(
            `-Rp ${totalDiscount.toLocaleString("id-ID")}`,
            460,
            yPosition,
            { width: 80, align: "right" }
          );

        yPosition += 20;
      }

      doc
        .fillColor("#666666")
        .text("PPN (11%):", 380, yPosition, { width: 80, align: "right" })
        .fillColor("#333333")
        .text(`Rp ${ppn.toLocaleString("id-ID")}`, 460, yPosition, {
          width: 80,
          align: "right",
        });

      yPosition += 30;

      doc
        .fillColor("#666666")
        .text("Total Amount", 380, yPosition, { width: 80, align: "right" })
        .fillColor("#333333")
        .text(`Rp ${grandTotal.toLocaleString("id-ID")}`, 460, yPosition, {
          width: 80,
          align: "right",
        });

      yPosition += 30;

      const footerY = 720;

      doc
        .strokeColor("#e5e7eb")
        .lineWidth(1)
        .moveTo(50, footerY)
        .lineTo(545, footerY)
        .stroke();

      doc
        .fontSize(9)
        .fillColor("#666666")
        .text("Thank you for your registration!", 50, footerY + 15)
        .text(
          "For any inquiries, please contact us at legacy@tq-official.com",
          50,
          footerY + 30
        )
        .text(
          `Generated on ${new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}`,
          50,
          footerY + 45,
          { align: "center", width: 495 }
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
