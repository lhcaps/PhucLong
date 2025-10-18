
// routes/payment.routes.js
const express = require("express");
const { authenticateJWT, authorizeAdmin } = require("../middleware/auth.middleware");

const PaymentController = require("../controllers/payment.controller");
const VoucherController = require("../controllers/voucher.controller");
const router = express.Router();

// ===== VNPay =====
router.post("/vnpay/create", authenticateJWT, PaymentController.vnpayCreate);
router.get("/vnpay_return", PaymentController.vnpayReturn);
router.get("/vnpay_ipn", PaymentController.vnpayIpn);

// DEV helper (optional)
router.post("/dev/confirm", authenticateJWT, authorizeAdmin, PaymentController.devConfirm);

// ===== Voucher Payment =====
router.post("/voucher/preview", authenticateJWT, VoucherController.preview);
router.post("/voucher/confirm", authenticateJWT, VoucherController.confirm);

module.exports = router;
