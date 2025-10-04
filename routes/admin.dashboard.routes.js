const express = require('express');
const { authenticateJWT, authorizeAdmin } = require('../middleware/auth.middleware');
const AdminDashboardService = require('../services/admin.dashboard.service');

const router = express.Router();

// ✅ Lấy thống kê tổng quan
router.get('/stats', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const stats = await AdminDashboardService.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
