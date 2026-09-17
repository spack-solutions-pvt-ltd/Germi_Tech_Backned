"use strict";
const { emailLayout } = require("./emailLayout");

function otpEmailTemplate({ name, otp, expiresInMinutes = 10 }) {
  const body = `
    <p>Hi ${name},</p>
    <p>Use the code below to reset your password. It expires in ${expiresInMinutes} minutes.</p>
    <p style="font-size:32px; font-weight:bold; letter-spacing:8px; text-align:center; color:#769b69; margin:24px 0;">${otp}</p>
    <p style="font-size:13px; color:#888;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
  `;
  return emailLayout({ title: "Your password reset code", bodyHtml: body });
}

module.exports = { otpEmailTemplate };