require("dotenv").config();
const nodemailer = require("nodemailer");

(async () => {
  try {
    console.log("📧 Đang thử gửi mail qua Gmail...");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT?.trim() || 465),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.SMTP_USER}>`,
      to: "duca17108@gmail.com",
      subject: "🔧 Test gửi email từ Phúc Long BE",
      text: "Nếu bạn nhận được email này, nghĩa là Gmail SMTP hoạt động.",
    });

    console.log("✅ Gửi thành công:", info.response);
  } catch (err) {
    console.error("❌ Gửi thất bại:", err);
  }
})();
