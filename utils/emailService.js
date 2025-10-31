const nodemailer = require("nodemailer");
const path = require("path");
const { generateInvoiceFile } = require("../utils/generateInvoice");
const prisma = require("../config/prismaClient");
const fs = require("fs");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * @param {Object} participant
 * @param {string} participant.name
 * @param {string} participant.email
 */
async function sendConfirmationEmail(participant) {
  // Ambil data registration lengkap dengan semua field yang dibutuhkan
  const registration = await prisma.registration.findFirst({
    where: { id: participant.registrationId },
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
          city: true,
          referralCode: true,
          discountAmount: true,
        },
      },
    },
  });

  if (!registration) {
    throw new Error(
      `Registration not found for participant ${participant.name}`
    );
  }

  // Format registration data sesuai kebutuhan generateInvoiceFile
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

  // Buat objek registration yang lengkap untuk generateInvoiceFile
  const formattedRegistration = {
    ...registration,
    program_title: registration.program.title,
    duration: registration.program.duration,
    actual_price_per_participant: actualPricePerParticipant,
    discount_total: discountTotal,
    grand_total: registration.totalAmount,
  };

  let invoicePath = null;
  try {
    invoicePath = await generateInvoiceFile(formattedRegistration);
    console.log(`Invoice generated successfully at: ${invoicePath}`);
  } catch (err) {
    console.error("Gagal membuat invoice untuk email:", err);
    // Jangan throw error, biarkan email tetap terkirim tanpa invoice
  }

  const mailOptions = {
    from: `"Legacy Team" <${process.env.EMAIL_USER}>`,
    to: participant.email,
    subject: "Legacy Program Registration Confirmation",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
        <div style="text-align: start; margin-bottom: 20px;">
          <img src="cid:legacylogo" alt="Legacy Logo" style="width: 180px;"/>
        </div>

        <p>Dear <b>${participant.name}</b>,</p>

        <p>
          We are delighted to welcome you in the <b>Legacy community</b>.
          It is our honor to have you join this meaningful journey, where we will learn, connect, and create meaningful experiences and lasting impact.
        </p>

        <p>
          Your payment has been successfully confirmed. Please find the attached <b>invoice</b> for your record.
        </p>

        <p>
        Further information regarding the program agenda, guidelines, and relevant materials will be provided in due course via your registered email and WhatsApp number. Please ensure that your contact details remain active for seamless communication.
        </p>

        <p>
          For any inquiries, contact us at <b>+62 815-1530-0511</b>. Our team will be glad to support you.
        </p>

        <p>
          Thank you for your trust and commitment. We look forward to your active participation in the Legacy program and to embarking on this remarkable journey together.
        </p>

        <p style="margin-top: 30px;">
          Sincerely,<br/>
          <b>Legacy Team</b>
        </p>
      </div>
    `,
    attachments: [
      {
        filename: "legacy-logo.png",
        path: path.join(__dirname, "../assets/legacy-logo.png"),
        cid: "legacylogo",
      },
      ...(invoicePath && fs.existsSync(invoicePath)
        ? [
            {
              filename: `INVOICE-${registration.registrationId}.pdf`,
              path: invoicePath,
              contentType: "application/pdf",
            },
          ]
        : []),
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(
      `Confirmation email sent to ${participant.email} ${
        invoicePath ? "with" : "without"
      } invoice attachment`
    );
  } finally {
    // Hapus file invoice setelah email terkirim
    if (invoicePath && fs.existsSync(invoicePath)) {
      try {
        fs.unlinkSync(invoicePath);
        console.log(`Temporary invoice file deleted: ${invoicePath}`);
      } catch (err) {
        console.error(`Failed to delete temporary invoice: ${err}`);
      }
    }
  }
}

module.exports = { sendConfirmationEmail };
