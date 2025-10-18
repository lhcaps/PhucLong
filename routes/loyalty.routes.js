// routes/loyalty.routes.js
const express = require("express");
const { authenticateJWT, authorizeAdmin } = require("../middleware/auth.middleware");
const LoyaltyService = require("../services/loyalty.service");

const router = express.Router();

// ✅ User: xem điểm hiện tại
router.get("/me", authenticateJWT, async (req, res) => {
  try {
    const points = await LoyaltyService.getPoints(req.user.userId);
    res.json({ points });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ User: đổi điểm lấy voucher
router.post("/redeem", authenticateJWT, async (req, res) => {
  try {
    const { requiredPoints, discountPercent } = req.body;
    const result = await LoyaltyService.redeemVoucher(
      req.user.userId,
      requiredPoints,
      discountPercent
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ User: lịch sử giao dịch loyalty
router.get("/transactions", authenticateJWT, async (req, res) => {
  try {
    const data = await LoyaltyService.getAllTransactions(req.user.userId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: xem tất cả
router.get("/admin/transactions", authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { userId } = req.query;
    const data = await LoyaltyService.getAllTransactions(userId || null);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Alias: /points
router.get("/points", authenticateJWT, async (req, res) => {
  try {
    const points = await LoyaltyService.getPoints(req.user.userId);
    res.json({ points });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
