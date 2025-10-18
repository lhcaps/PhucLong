// services/admin/admin.transaction.service.js
const { sql, poolPromise } = require("../../config/db");

class AdminTransactionService {
  // ✅ Danh sách tất cả giao dịch
  static async getAll(filters = {}) {
    const pool = await getPool();
    const { provider, status, userId, orderId } = filters;

    let query = `
      SELECT 
        t.Id, t.OrderId, t.Provider, t.TxnRef, t.Amount, t.Currency, t.Status, t.CreatedAt,
        o.PaymentMethod, o.PaymentStatus,
        u.Id AS UserId, u.Name AS UserName, u.Email
      FROM Transactions t
      JOIN Orders o ON t.OrderId = o.Id
      JOIN Users u ON o.UserId = u.Id
      WHERE 1=1
    `;

    const req = pool.request();
    if (provider) {
      query += " AND t.Provider=@Provider";
      req.input("Provider", sql.NVarChar, provider);
    }
    if (status) {
      query += " AND t.Status=@Status";
      req.input("Status", sql.NVarChar, status);
    }
    if (userId) {
      query += " AND u.Id=@UserId";
      req.input("UserId", sql.Int, userId);
    }
    if (orderId) {
      query += " AND t.OrderId=@OrderId";
      req.input("OrderId", sql.Int, orderId);
    }

    query += " ORDER BY t.CreatedAt DESC";

    const result = await req.query(query);
    return result.recordset;
  }

  // ✅ Xem chi tiết 1 giao dịch
  static async getById(id) {
    const pool = await getPool();
    const result = await pool.request()
      .input("Id", sql.Int, id)
      .query(`
        SELECT 
          t.Id, t.OrderId, t.Provider, t.TxnRef, t.Amount, t.Currency, t.Status, t.CreatedAt,
          o.PaymentMethod, o.PaymentStatus, o.Total, o.Status AS OrderStatus,
          u.Id AS UserId, u.Name AS UserName, u.Email
        FROM Transactions t
        JOIN Orders o ON t.OrderId = o.Id
        JOIN Users u ON o.UserId = u.Id
        WHERE t.Id=@Id
      `);

    if (!result.recordset.length)
      return { ok: false, error: "TRANSACTION_NOT_FOUND" };

    return { ok: true, data: result.recordset[0] };
  }

  // ✅ Thống kê doanh thu (tổng, theo ngày, theo provider)
  static async getStats() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        COUNT(*) AS TotalTransactions,
        SUM(CASE WHEN t.Status='success' THEN t.Amount ELSE 0 END) AS TotalRevenue,
        SUM(CASE WHEN t.Provider='VNPAY' THEN t.Amount ELSE 0 END) AS VnPayRevenue,
        SUM(CASE WHEN t.Provider='VOUCHER' THEN t.Amount ELSE 0 END) AS VoucherUsed,
        SUM(CASE WHEN t.Provider='COD' THEN t.Amount ELSE 0 END) AS CodAmount
      FROM Transactions t
    `);

    const perDay = await pool.request().query(`
      SELECT 
        CAST(t.CreatedAt AS DATE) AS Date,
        SUM(CASE WHEN t.Status='success' THEN t.Amount ELSE 0 END) AS Revenue
      FROM Transactions t
      GROUP BY CAST(t.CreatedAt AS DATE)
      ORDER BY Date DESC
    `);

    return { ok: true, summary: result.recordset[0], perDay: perDay.recordset };
  }
}

module.exports = AdminTransactionService;
