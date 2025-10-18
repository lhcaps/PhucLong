// src/services/email.service.js
const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Dev logging
console.log("📧 SMTP Config:", {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS ? "✅ Loaded" : "❌ Missing",
});

const EmailService = {
  async sendVerificationEmail(to, name, verifyUrl) {
    const html = `
      <div style="font-family:Arial;padding:16px;">
        <h2 style="color:#006341">Xác nhận tài khoản Phúc Long</h2>
        <p>Xin chào ${name}, vui lòng nhấn vào liên kết dưới đây để kích hoạt tài khoản:</p>
        <a href="${verifyUrl}" style="color:#006341;font-weight:bold;">${verifyUrl}</a>
        <p>Nếu bạn không đăng ký, hãy bỏ qua email này.</p>
      </div>`;
    await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.SMTP_USER}>`,
      to,
      subject: "Xác nhận tài khoản Phúc Long",
      html,
    });
  },

  async sendResetPasswordEmail(to, name, resetUrl) {
    const html = `
      <div style="font-family:Arial;padding:16px;">
        <h2 style="color:#006341">Đặt lại mật khẩu</h2>
        <p>Xin chào ${name}, nhấn liên kết dưới đây để đặt lại mật khẩu:</p>
        <a href="${resetUrl}" style="color:#006341;font-weight:bold;">${resetUrl}</a>
        <p>Liên kết này hết hạn sau 15 phút.</p>
      </div>`;
    await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.SMTP_USER}>`,
      to,
      subject: "Đặt lại mật khẩu Phúc Long",
      html,
    });
  },
};

module.exports = EmailService;
