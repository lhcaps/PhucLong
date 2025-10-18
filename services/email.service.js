// src/services/email.service.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const EmailService = {
  async sendVerificationEmail(to, name, verifyUrl) {
    const html = `
      <div style="font-family:Arial;padding:16px;">
        <h2 style="color:#006341">Xác nhận tài khoản Phúc Long</h2>
        <p>Xin chào ${name}, hãy nhấn vào liên kết để kích hoạt:</p>
        <a href="${verifyUrl}" style="color:#006341;font-weight:bold;">${verifyUrl}</a>
      </div>`;
    await transporter.sendMail({
      from: `"Phúc Long Coffee" <${process.env.MAIL_USER}>`,
      to, subject: "Xác nhận tài khoản", html,
    });
  },

  async sendResetPasswordEmail(to, name, resetUrl) {
    const html = `
      <div style="font-family:Arial;padding:16px;">
        <h2 style="color:#006341">Đặt lại mật khẩu</h2>
        <p>Xin chào ${name}, hãy nhấn liên kết dưới đây để đặt lại mật khẩu:</p>
        <a href="${resetUrl}" style="color:#006341;font-weight:bold;">${resetUrl}</a>
        <p>Liên kết này hết hạn sau 15 phút.</p>
      </div>`;
    await transporter.sendMail({
      from: `"Phúc Long Coffee" <${process.env.MAIL_USER}>`,
      to, subject: "Đặt lại mật khẩu", html,
    });
  },
};

module.exports = EmailService;
