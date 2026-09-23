"use strict";
const nodemailer = require("nodemailer");
const path = require("path");

// Configure via .env — works with Gmail SMTP, SES SMTP, or any provider's SMTP creds.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
// Logo path
const logoPath = path.join(__dirname, "../../assets/Logo.png");

async function sendMail({ to, subject, html }) {
  return transporter.sendMail({
    from: process.env.MAIL_FROM || `"Germitech" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    attachments: [
      {
        filename: "Logo.png",
        path: logoPath,
        cid: "germitech-logo",
      },
    ],
  });
}

module.exports = { sendMail, transporter };
