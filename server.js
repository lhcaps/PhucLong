// ======================================================
// 🌱 Load Environment Variables
// ======================================================
require("dotenv").config();

// ======================================================
// 🧩 Core Dependencies
// ======================================================
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

// ======================================================
// 🧰 Utilities & Middlewares
// ======================================================
const logger = require("./utils/logger");
const { authenticateJWT, authorizeAdmin } = require("./middleware/auth.middleware");
const { apiLimiter, loginLimiter } = require("./middleware/rateLimiter");

// ✅ Cron job dọn refresh token hết hạn
require("./jobs/cleanupTokens");

// ======================================================
// 🚀 Express App
// ======================================================
const app = express();

// ======================================================
// ⚙️ Base Middlewares
// ======================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(compression());

// ======================================================
// 🌐 CORS Setup
// ======================================================
app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = [
        process.env.FRONTEND_URL || "http://localhost:5173",
        "http://localhost:5174",
        "https://phuclong.vn",
      ];
      if (!origin || allowed.includes(origin)) return cb(null, true);
      return cb(new Error("❌ Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ======================================================
// 🩺 Health Check
// ======================================================
app.get("/", (req, res) => {
  res.send("🚀 PhucLong API is running perfectly!");
});

// ======================================================
// ⏱️ Global Rate Limiter
// ======================================================
app.use("/api", apiLimiter);

// ======================================================
// 🔓 PUBLIC ROUTES (Không yêu cầu đăng nhập)
// ======================================================
app.use("/api/auth", loginLimiter, require("./routes/auth.routes"));
app.use("/api/products", require("./routes/product.routes"));
app.use("/api/categories", require("./routes/category.routes")); 
app.use("/api/payment", require("./routes/payment.routes"));
app.use("/api/stores", require("./routes/store.routes"));

// Voucher public → có thể yêu cầu auth tùy business
app.use("/api/vouchers", authenticateJWT, require("./routes/voucher.routes"));

// ======================================================
// 🔐 USER ROUTES (Yêu cầu đăng nhập)
// ======================================================
app.use("/api/cart", authenticateJWT, require("./routes/cart.routes"));
app.use("/api/orders", authenticateJWT, require("./routes/order.routes"));
app.use("/api/loyalty", authenticateJWT, require("./routes/loyalty.routes"));
app.use("/api/history", authenticateJWT, require("./routes/orderHistory.routes"));

// ⭐ Reviews (đánh giá sản phẩm)
app.use("/api/reviews", authenticateJWT, require("./routes/review.routes"));

// ======================================================
// 🧑‍💼 ADMIN ROUTES (Yêu cầu quyền admin)
// ======================================================
app.use(
  "/api/admin/dashboard",
  authenticateJWT,
  authorizeAdmin,
  require("./routes/admin/admin.dashboard.routes")
);
app.use(
  "/api/admin/users",
  authenticateJWT,
  authorizeAdmin,
  require("./routes/admin/admin.user.routes")
);
app.use(
  "/api/admin/employees",
  authenticateJWT,
  authorizeAdmin,
  require("./routes/admin/admin.employee.routes")
);
app.use(
  "/api/admin/orders",
  authenticateJWT,
  authorizeAdmin,
  require("./routes/admin/admin.order.routes")
);
app.use(
  "/api/admin/products",
  authenticateJWT,
  authorizeAdmin,
  require("./routes/admin/admin.product.routes")
);
app.use(
  "/api/admin/loyalty",
  authenticateJWT,
  authorizeAdmin,
  require("./routes/admin/admin.loyalty.routes")
);
app.use(
  "/api/admin/inventory",
  authenticateJWT,
  authorizeAdmin,
  require("./routes/admin/admin.inventory.routes")
);
app.use(
  "/api/admin/vouchers",
  authenticateJWT,
  authorizeAdmin,
  require("./routes/admin/admin.voucher.routes")
);
app.use(
  "/api/admin/reviews",
  authenticateJWT,
  authorizeAdmin,
  require("./routes/admin/admin.review.routes")
);
app.use(
  "/api/admin/transactions",
  authenticateJWT,
  authorizeAdmin,
  require("./routes/admin/admin.transaction.routes")
);
app.use(
  "/api/admin/categories",
  authenticateJWT,
  authorizeAdmin,
  require("./routes/admin/admin.category.routes")
);

// ======================================================
// ⚠️ GLOBAL ERROR HANDLER
// ======================================================
app.use((err, req, res, next) => {
  logger.error(err);

  if (err.message.includes("Not allowed by CORS")) {
    return res
      .status(403)
      .json({ success: false, error: { code: "CORS_ERROR", message: err.message } });
  }

  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_ERROR",
      message: err.message || "Internal server error",
    },
  });
});

// ======================================================
// 🚀 START SERVER
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`✅ Server chạy ở http://localhost:${PORT}`);
  console.log("✅ SQL Server và API đều sẵn sàng hoạt động!");
});

module.exports = app;
