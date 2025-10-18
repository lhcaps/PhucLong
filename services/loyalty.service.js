// services/loyalty.service.js
const { sql, getPool } = require("../config/db");


class LoyaltyService {
  // ✅ Lấy điểm hiện tại
  static async getPoints(userId) {
    const pool = await getPool();
    const result = await pool.request()
      .input("Id", sql.Int, userId)
      .query("SELECT LoyaltyPoints FROM Users WHERE Id=@Id");
    return result.recordset[0]?.LoyaltyPoints || 0;
  }

  // ✅ Cộng điểm (tự động khi đơn hàng hoàn tất)
  static async addPoints(userId, amount, orderId = null) {
    const points = Math.floor(amount / 1000); // 1k = 1 point
    const pool = await getPool();

    await pool.request()
      .input("Id", sql.Int, userId)
      .input("Points", sql.Int, points)
      .query("UPDATE Users SET LoyaltyPoints = LoyaltyPoints + @Points WHERE Id=@Id");

    await pool.request()
      .input("UserId", sql.Int, userId)
      .input("OrderId", sql.Int, orderId)
      .input("Points", sql.Int, points)
      .input("Note", sql.NVarChar, "Cộng điểm từ đơn hàng hoàn tất")
      .query(`
        INSERT INTO LoyaltyTransactions (UserId, OrderId, Points, Note)
        VALUES (@UserId, @OrderId, @Points, @Note)
      `);

    return { message: `+${points} điểm Loyalty` };
  }

  // ✅ Đổi điểm lấy voucher (voucher chuẩn mới)
  static async redeemVoucher(userId, requiredPoints, discountPercent) {
    const pool = await getPool();

    // Kiểm tra điểm
    const userRes = await pool.request()
      .input("Id", sql.Int, userId)
      .query("SELECT LoyaltyPoints FROM Users WHERE Id=@Id");
    const current = userRes.recordset[0]?.LoyaltyPoints || 0;
    if (current < requiredPoints)
      throw new Error("Không đủ điểm để đổi voucher");

    const code = "LOYALTY-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);

    // Ghi vào bảng Vouchers (schema mới)
    await pool.request()
      .input("Code", sql.NVarChar, code)
      .input("Type", sql.NVarChar, "PERCENT")
      .input("Value", sql.Decimal(18, 2), discountPercent)
      .input("MaxDiscount", sql.Decimal(18, 2), 50000)
      .input("MinOrder", sql.Decimal(18, 2), 100000)
      .input("UsageLimit", sql.Int, 1)
      .input("IsActive", sql.Bit, 1)
      .input("Origin", sql.NVarChar, "LOYALTY")
      .input("StartAt", sql.DateTime, new Date())
      .input("EndAt", sql.DateTime, expiry)
      .query(`
        INSERT INTO Vouchers
        (Code, Type, Value, MaxDiscount, MinOrder, UsageLimit, UsedCount, IsActive, Origin, StartAt, EndAt)
        VALUES
        (@Code, @Type, @Value, @MaxDiscount, @MinOrder, @UsageLimit, 0, @IsActive, @Origin, @StartAt, @EndAt)
      `);

    // Trừ điểm
    await pool.request()
      .input("Id", sql.Int, userId)
      .input("RequiredPoints", sql.Int, requiredPoints)
      .query("UPDATE Users SET LoyaltyPoints = LoyaltyPoints - @RequiredPoints WHERE Id=@Id");

    return {
      message: "🎁 Đổi voucher thành công",
      code,
      discountPercent,
      expiry
    };
  }

  // ✅ Lịch sử giao dịch loyalty (Admin/User)
  static async getAllTransactions(userId = null) {
    const pool = await getPool();
    let query = `
      SELECT lt.Id, lt.UserId, u.Name AS UserName, lt.OrderId,
             lt.Points, lt.Note, lt.CreatedAt
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
