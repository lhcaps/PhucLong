const rateLimit = require("express-rate-limit");

// ⚙️ Giới hạn chung cho mọi API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 500, // tối đa 500 request/15 phút
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "⏳ Too many requests, try again later." },
});

// ⚙️ Login limiter (cho phép nhiều hơn khi dev)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // reset mỗi 1 phút
  max: 20, // 20 lần/phút thay vì 5 lần/15 phút
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "🚫 Too many login attempts, please wait a moment." },
});

module.exports = { apiLimiter, loginLimiter };
