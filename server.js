require("dotenv").config();
const express = require("express");
const cors = require("cors");
const logger = require("./utils/logger");
const { authenticateJWT, authorizeAdmin } = require("./middleware/auth.middleware");
const { apiLimiter, loginLimiter } = require("./middleware/rateLimiter");

// ✅ Cron job cleanup refresh tokens
require("./jobs/cleanupTokens");

const app = express();

// ✅ Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ CORS config
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Health check
app.get("/", (req, res) => res.send("🚀 PhucLong API Running"));
app.set('trust proxy', 1);

// ✅ Global API rate limit
app.use("/api", apiLimiter);

// ----------------- Public routes -----------------
app.use("/api/auth", loginLimiter, require("./routes/auth.routes"));        // register, login, profile
app.use("/api/products", require("./routes/product.routes"));               // get list, get by id, filter/sort
app.use("/api/categories", require("./routes/category.routes"));            // category list
app.use("/api/payment", require("./routes/payment.routes"));                // VNPay (MoMo nếu có)
app.use("/api/stores", require("./routes/store.routes"));                   // ✅ ĐÚNG TÊN FILE

// ----------------- Protected (user) routes -----------------
app.use("/api/cart", authenticateJWT, require("./routes/cart.routes"));     // add/remove/update/view cart
app.use("/api/orders", authenticateJWT, require("./routes/order.routes"));  // order
app.use("/api/loyalty", authenticateJWT, require("./routes/loyalty.routes"));// loyalty

// ----------------- Admin routes (đã bọc auth + authorizeAdmin) -----------------
app.use("/api/admin/products", authenticateJWT, authorizeAdmin, require("./routes/admin.product.routes"));
app.use("/api/admin/users", authenticateJWT, authorizeAdmin, require("./routes/admin.user.routes"));
app.use("/api/admin/orders", authenticateJWT, authorizeAdmin, require("./routes/admin.order.routes"));
app.use("/api/admin/inventory", authenticateJWT, authorizeAdmin, require("./routes/admin.inventory.routes"));
app.use("/api/admin/loyalty", authenticateJWT, authorizeAdmin, require("./routes/admin.loyalty.routes"));
app.use("/api/admin/dashboard", authenticateJWT, authorizeAdmin, require("./routes/admin.dashboard.routes"));

// ----------------- Global Error Handler -----------------
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({
    success: false,
    error: { code: err.code || "INTERNAL", message: err.message || "Internal server error" },
  });
});

// ----------------- Start server -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`✅ Server chạy ở http://localhost:${PORT}`);
});

module.exports = app; // để CI/test có thể require
