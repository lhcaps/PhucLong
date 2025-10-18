const { sql, poolPromise } = require("../../config/db");

class AdminLoyaltyService {
  // Lấy toàn bộ lịch sử điểm thưởng
  static async getAllTransactions() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        lt.Id, lt.UserId, u.Name AS UserName, u.Email,
        lt.Points, lt.Reason, lt.CreatedAt
      FROM LoyaltyTransactions lt
      JOIN Users u ON lt.UserId = u.Id
      ORDER BY lt.CreatedAt DESC
    `);
    return result.recordset;
  }

  // Cộng/trừ điểm thủ công
  static async adjustPoints({ userId, points, reason }) {
    if (!userId || !points) throw new Error("Thiếu userId hoặc points");

    const pool = await getPool();

    // Cập nhật điểm user
    await pool.request()
      .input("UserId", sql.Int, userId)
      .input("Points", sql.Int, points)
      .query("UPDATE Users SET LoyaltyPoints = LoyaltyPoints + @Points WHERE Id=@UserId");

    // Ghi log giao dịch loyalty
    await pool.request()
      .input("UserId", sql.Int, userId)
      .input("OrderId", sql.Int, null)
      .input("Points", sql.Int, points)
      .input("Reason", sql.NVarChar, reason || "Admin manual adjust")
      .query(`
        INSERT INTO LoyaltyTransactions (UserId, OrderId, Points, Reason)
        VALUES (@UserId, @OrderId, @Points, @Reason)
      `);

    return { message: "✅ Adjust loyalty points thành công" };
  }
}



module.exports = AdminLoyaltyService;
