const { sql, poolPromise } = require("../config/db");

class LoyaltyService {
  // Điểm hiện tại của user
  static async getPoints(userId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("Id", sql.Int, userId)
      .query("SELECT LoyaltyPoints FROM Users WHERE Id=@Id");
    return result.recordset[0]?.LoyaltyPoints || 0;
  }

  // Cộng điểm + log lịch sử (dùng cho completed order)
  static async addPoints(userId, amount, orderId = null) {
    const points = Math.floor(amount / 1000); // 1k = 1 point
    const pool = await poolPromise;

    // Update Users
    await pool.request()
      .input("Id", sql.Int, userId)
      .input("Points", sql.Int, points)
      .query("UPDATE Users SET LoyaltyPoints = LoyaltyPoints + @Points WHERE Id=@Id");

    // Log vào LoyaltyTransactions
    await pool.request()
      .input("UserId", sql.Int, userId)
      .input("OrderId", sql.Int, orderId)
      .input("Points", sql.Int, points)
      .input("Note", sql.NVarChar, "Cộng điểm từ đơn hàng")
      .query(`
        INSERT INTO LoyaltyTransactions (UserId, OrderId, Points, Note)
        VALUES (@UserId, @OrderId, @Points, @Note)
      `);

    return { message: `+${points} điểm TuVi Loyalty` };
  }

  // Đổi điểm lấy voucher
  static async redeemVoucher(userId, requiredPoints, discountPercent) {
    const pool = await poolPromise;

    const userRes = await pool.request()
      .input("Id", sql.Int, userId)
      .query("SELECT LoyaltyPoints FROM Users WHERE Id=@Id");

    const current = userRes.recordset[0]?.LoyaltyPoints || 0;
    if (current < requiredPoints) throw new Error("Không đủ điểm");

    const code = "VOUCHER-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);

    await pool.request()
      .input("Code", sql.NVarChar, code)
      .input("DiscountPercent", sql.Int, discountPercent)
      .input("RequiredPoints", sql.Int, requiredPoints)
      .input("ExpiryDate", sql.DateTime, expiry)
      .query(`
        INSERT INTO Vouchers (Code, DiscountPercent, RequiredPoints, ExpiryDate)
        VALUES (@Code, @DiscountPercent, @RequiredPoints, @ExpiryDate)
      `);

    await pool.request()
      .input("Id", sql.Int, userId)
      .input("RequiredPoints", sql.Int, requiredPoints)
      .query("UPDATE Users SET LoyaltyPoints = LoyaltyPoints - @RequiredPoints WHERE Id=@Id");

    return { message: "🎁 Đổi voucher thành công", code, discount: discountPercent, expiry };
  }

  // Admin: xem lịch sử loyalty (optional filter userId)
  static async getAllTransactions(userId = null) {
    const pool = await poolPromise;
    let query = `
      SELECT lt.Id, lt.UserId, u.Name AS UserName, lt.OrderId, lt.Points, lt.Note, lt.CreatedAt
      FROM LoyaltyTransactions lt
      JOIN Users u ON lt.UserId = u.Id
      WHERE 1=1
    `;
    const request = pool.request();
    if (userId) {
      query += " AND lt.UserId=@UserId";
      request.input("UserId", sql.Int, userId);
    }
    query += " ORDER BY lt.CreatedAt DESC";

    const result = await request.query(query);
    return result.recordset;
  }
}

module.exports = LoyaltyService;
