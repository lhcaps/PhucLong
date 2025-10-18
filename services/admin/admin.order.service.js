const { sql, poolPromise } = require("../../config/db");

class AdminOrderService {
  // Lấy danh sách đơn hàng
  static async getAll() {
    const pool = await getPool();
    const res = await pool.request().query(`
      SELECT 
        o.Id, o.UserId, u.Name AS CustomerName, u.Email, o.Total, o.Status, 
        o.PaymentStatus, o.CreatedAt
      FROM Orders o
      JOIN Users u ON o.UserId = u.Id
      ORDER BY o.CreatedAt DESC
    `);
    return res.recordset;
  }

  // Lấy chi tiết đơn hàng
  static async getById(id) {
    const pool = await getPool();
    const res = await pool.request()
      .input("Id", sql.Int, id)
      .query(`
        SELECT 
          o.Id, o.Total, o.Status, o.PaymentStatus, o.CreatedAt,
          u.Name AS CustomerName, u.Email, u.Phone
        FROM Orders o
        JOIN Users u ON o.UserId = u.Id
        WHERE o.Id = @Id
      `);
    if (!res.recordset.length) throw new Error("Không tìm thấy đơn hàng");

    const items = await pool.request()
      .input("OrderId", sql.Int, id)
      .query(`
        SELECT oi.*, p.Name AS ProductName
        FROM OrderItems oi
        JOIN Products p ON oi.ProductId = p.Id
        WHERE oi.OrderId = @OrderId
      `);

    return { ...res.recordset[0], Items: items.recordset };
  }

  // Cập nhật trạng thái đơn hàng
  static async updateStatus(orderId, status) {
    const valid = ["pending", "confirmed", "processing", "completed", "cancelled"];
    if (!valid.includes(status)) throw new Error("Trạng thái không hợp lệ");

    const pool = await getPool();
    await pool.request()
      .input("Id", sql.Int, orderId)
      .input("Status", sql.NVarChar, status)
      .query("UPDATE Orders SET Status=@Status WHERE Id=@Id");

    return { message: `✅ Đơn hàng #${orderId} đã cập nhật trạng thái thành ${status}` };
  }

  // Xóa đơn hàng (nếu cần)
  static async delete(id) {
    const pool = await getPool();
    await pool.request().input("Id", sql.Int, id)
      .query("DELETE FROM Orders WHERE Id=@Id");
    return { message: `🗑️ Đã xóa đơn hàng #${id}` };
  }
}

module.exports = AdminOrderService;
