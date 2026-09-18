"use strict";
const { emailLayout } = require("./emailLayout");

function otpEmailTemplate({ name, otp, expiresInMinutes = 10 }) {
  const body = `
    <p>Hi ${name},</p>
    <p>We received a request to reset your password. Please use the verification code below to continue:</p>
    <p style="font-size:32px; font-weight:bold; letter-spacing:8px; text-align:center; color:#769b69; margin:24px 0;">${otp}</p>
    <p style="font-size:13px; color:#888;">This OTP is valid for ${expiresInMinutes} minutes. If you did not request a password reset, please contact our support team immediately.</p>
  `;
  return emailLayout({ title: "Your password reset code", bodyHtml: body });
}

module.exports = { otpEmailTemplate };
