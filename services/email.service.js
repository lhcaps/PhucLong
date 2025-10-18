const nodemailer = require("nodemailer");
require("dotenv").config();

async function createTransporter() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT?.trim() || 465),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  const testAccount = await nodemailer.createTestAccount();
  console.warn("⚠️ Không tìm thấy SMTP config — fallback Ethereal");
  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: testAccount.auth,
  });
}

const BRAND = {
  name: "Phúc Long Coffee & Tea",
  logo: "https://phuclong.com.vn/images/logo.png",
  primary: "#006341",
  footer:
    "© 2025 Phúc Long Coffee & Tea. Liên hệ CSKH: <a href='mailto:support@phuclong.com.vn' style='color:#006341;'>support@phuclong.com.vn</a>",
};

function buildEmailTemplate({ title, greeting, body, buttonText, buttonLink }) {
  return `
  <!DOCTYPE html>
  <html><body style="font-family:Arial,sans-serif;background:#f9f9f9;margin:0;">
  <table width="100%" style="background:#f9f9f9;"><tr><td align="center">
  <table width="600" style="background:#fff;border-radius:8px;overflow:hidden;margin-top:40px;">
  <tr><td align="center" style="background:${BRAND.primary};padding:20px;">
  <img src="${BRAND.logo}" alt="${BRAND.name}" width="120" height="120"/>
  </td></tr>
  <tr><td style="padding:30px;color:#333;">
  <h2 style="color:${BRAND.primary};text-align:center;">${title}</h2>
  <p>${greeting}</p><p style="color:#555;">${body}</p>
  ${buttonText && buttonLink ? `
  <div style="text-align:center;margin:30px 0;">
  <a href="${buttonLink}" target="_blank"
  style="background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:5px;text-decoration:none;font-weight:bold;">
  ${buttonText}</a></div>` : ""}
  <p style="font-size:13px;color:#999;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
  </td></tr>
  <tr><td style="background:#f1f1f1;padding:15px;text-align:center;font-size:12px;color:#777;">
  ${BRAND.footer}</td></tr></table></td></tr></table></body></html>`;
}

const EmailService = {
  async sendVerificationEmail(to, name, verifyUrl) {
    try {
      const transporter = await createTransporter();
      const html = buildEmailTemplate({
        title: "Xác minh tài khoản của bạn",
        greeting: `Xin chào <strong>${name}</strong>,`,
        body: "Cảm ơn bạn đã đăng ký tài khoản tại Phúc Long. Nhấn nút bên dưới để xác minh tài khoản.",
        buttonText: "Xác minh ngay",
        buttonLink: verifyUrl,
      });

      const info = await transporter.sendMail({
        from: `"${BRAND.name}" <${process.env.SMTP_USER}>`,
        to,
        subject: "✅ Xác minh tài khoản - Phúc Long Coffee & Tea",
        html,
      });
      console.log("📨 Gửi email xác minh:", to, info.response);
    } catch (err) {
      console.error("❌ Lỗi gửi email xác minh:", err.message);
    }
  },

  async sendResetPasswordEmail(to, name, resetUrl) {
    try {
      const transporter = await createTransporter();
      const html = buildEmailTemplate({
        title: "Đặt lại mật khẩu tài khoản",
        greeting: `Xin chào <strong>${name}</strong>,`,
        body: "Chúng tôi nhận được yêu cầu đặt lại mật khẩu. Vui lòng nhấn nút bên dưới để đặt lại.",
        buttonText: "Đặt lại mật khẩu",
        buttonLink: resetUrl,
      });

      const info = await transporter.sendMail({
        from: `"${BRAND.name}" <${process.env.SMTP_USER}>`,
        to,
        subject: "🔒 Đặt lại mật khẩu - Phúc Long Coffee & Tea",
        html,
      });
      console.log("📨 Gửi email đặt lại mật khẩu:", to, info.response);
    } catch (err) {
      console.error("❌ Lỗi gửi email reset password:", err.message);
    }
  },
};

module.exports = EmailService;
