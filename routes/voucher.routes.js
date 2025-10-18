// routes/voucher.routes.js
const express = require("express");
const { authenticateJWT } = require("../middleware/auth.middleware");
const VoucherController = require("../controllers/voucher.controller");

const router = express.Router();

// ✅ Preview voucher (user xem thử)
router.post("/preview", authenticateJWT, VoucherController.preview);

// ✅ Confirm voucher (user xác nhận)
router.post("/confirm", authenticateJWT, VoucherController.confirm);

module.exports = router;
