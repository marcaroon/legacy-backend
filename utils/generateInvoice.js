const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

async function generateInvoiceFile(registration) {
  return new Promise((resolve, reject) => {
    try {
      const tempDir = path.join(__dirname, "../temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

      const filePath = path.join(tempDir, `INVOICE-${registration.registrationId}.pdf`);
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

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
          `Payment Date: ${new Date(registration.paidAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}`
        );
      }

      doc.text(
        `Invoice Date: ${new Date(registration.createdAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`
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
          .text(`Rp ${pricePerParticipant.toLocaleString("id-ID")}`, 380, yPosition + 6, {
            width: 80,
            align: "right",
          })
          .text(`Rp ${pricePerParticipant.toLocaleString("id-ID")}`, 460, yPosition + 6, {
            width: 80,
            align: "right",
          });

        yPosition += 30;

        if (discount > 0) {
          doc
            .fillColor("#10b981")
            .text(`Referral Discount (${participant.referralCode})`, 60, yPosition)
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

      const subtotal = registration.totalParticipants * registration.actual_price_per_participant;
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
          .text("Total Discount:", 380, yPosition, { width: 80, align: "right" })
          .fillColor("#10b981")
          .text(`-Rp ${totalDiscount.toLocaleString("id-ID")}`, 460, yPosition, {
            width: 80,
            align: "right",
          });
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
        .text("For any inquiries, please contact us at legacy@tq-official.com", 50, footerY + 30)
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

      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateInvoiceFile };
