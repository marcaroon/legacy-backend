const nodemailer = require("nodemailer");
const path = require("path");

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
 * @param {Object} participant - Data peserta
 * @param {string} participant.name
 * @param {string} participant.email
 */
async function sendConfirmationEmail(participant) {
    const mailOptions = {
        from: `"Legacy Team" <${process.env.EMAIL_USER}>`,
        to: participant.email,
        subject: "Legacy Program Registration Confirmation",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
            <!-- Logo -->
            <div style="text-align: start; margin-bottom: 20px;">
              <img src="cid:legacylogo" alt="Legacy Logo" style="width: 180px;"/>
            </div>
    
            <!-- Greeting -->
            <p>Dear <b>${participant.name}</b>,</p>
    
            <!-- Body -->
            <p>
              We are delighted to welcome you in the <b>Legacy community</b>.  
              It is our honor to have you join this meaningful journey, where we will learn, connect, and create meaningful experiences and lasting impact.
            </p>
    
            <p>
              Further information regarding the program agenda, guidelines, and relevant materials will be provided in due course via your registered email and WhatsApp number.  
              Please ensure that your contact details remain active for seamless communication.
            </p>
    
            <p>
              For any inquiries or assistance, do not hesitate to contact us at <b>+62 815-1530-0511</b>.  
              Our team will be glad to support you.
            </p>
    
            <p>
              Thank you for your trust and commitment. We look forward to your active participation in the Legacy program and to embarking on this remarkable journey together.
            </p>
    
            <!-- Signature -->
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
        ],
      };

  await transporter.sendMail(mailOptions);
  console.log(
    `Confirmation email sent to ${participant.email}, sender ${process.env.EMAIL_USER}`
  );
}

module.exports = { sendConfirmationEmail };
