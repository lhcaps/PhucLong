const rateLimit = require("express-rate-limit");

// Giới hạn chung
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "⏳ Too many requests, try again later." },
});

// Login limiter
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "🚫 Too many login attempts, please wait a moment." },
});

// Forgot password limiter (chặt hơn)
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "🚫 Too many reset requests. Try again later." },
});

module.exports = { apiLimiter, loginLimiter, forgotLimiter };
