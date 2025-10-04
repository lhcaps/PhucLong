const express = require('express');
const { authenticateJWT, authorizeAdmin } = require('../middleware/auth.middleware');
const { sql, poolPromise } = require('../config/db');

const router = express.Router();

// ✅ Xem tất cả lịch sử loyalty
router.get('/transactions', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT lt.*, u.Name, u.Email 
      FROM LoyaltyTransactions lt
      JOIN Users u ON lt.UserId = u.Id
      ORDER BY lt.CreatedAt DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin cộng/trừ điểm thủ công
router.post('/adjust', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { userId, points, reason } = req.body;
    if (!userId || !points) return res.status(400).json({ error: "Thiếu userId hoặc points" });

    const pool = await poolPromise;

    // Update điểm user
    await pool.request()
      .input("UserId", sql.Int, userId)
      .input("Points", sql.Int, points)
      .query("UPDATE Users SET LoyaltyPoints = LoyaltyPoints + @Points WHERE Id=@UserId");

    // Log giao dịch loyalty
    await pool.request()
      .input("UserId", sql.Int, userId)
      .input("OrderId", sql.Int, null)
      .input("Points", sql.Int, points)
      .input("Reason", sql.NVarChar, reason || "Admin adjust")
      .query(`
        INSERT INTO LoyaltyTransactions (UserId, OrderId, Points, Reason)
        VALUES (@UserId, @OrderId, @Points, @Reason)
      `);

    res.json({ message: "✅ Adjust loyalty points thành công" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
