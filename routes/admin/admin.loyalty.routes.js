const express = require("express");
const { authenticateJWT, authorizeAdmin } = require("../../middleware/auth.middleware");
const AdminLoyaltyController = require("../../controllers/admin/admin.loyalty.controller");

const router = express.Router();
router.use(authenticateJWT, authorizeAdmin);

// ✅ Xem lịch sử loyalty
router.get("/transactions", AdminLoyaltyController.getTransactions);

// ✅ Cộng/trừ điểm thủ công
router.post("/adjust", AdminLoyaltyController.adjust);

module.exports = router;
