"use strict";
const { emailLayout } = require("./emailTemplate");

function welcomeEmailTemplate({ name, empId, email, password, loginUrl }) {
  const body = `
    <p>Hi ${name},</p>
    <p>Your Germitech account has been created. Here are your login details:</p>
    <table style="width:100%; margin: 16px 0; border-collapse: collapse;">
      <tr><td style="padding:6px 0; color:#555;">Employee ID</td><td style="padding:6px 0; font-weight:bold;">${empId}</td></tr>
      <tr><td style="padding:6px 0; color:#555;">Email</td><td style="padding:6px 0; font-weight:bold;">${email}</td></tr>
      <tr><td style="padding:6px 0; color:#555;">Temporary Password</td><td style="padding:6px 0; font-weight:bold;">${password}</td></tr>
    </table>
    <p>
      <a href="${loginUrl}" style="display:inline-block; background:#769b69; color:#fff; padding:10px 20px; border-radius:6px; text-decoration:none;">Log in to your account</a>
    </p>
    <p style="font-size:13px; color:#888;">For security, please change this password after your first login.</p>
  `;
  return emailLayout({ title: "Welcome to Germitech", bodyHtml: body });
}

module.exports = { welcomeEmailTemplate };