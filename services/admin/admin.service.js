const { sql, poolPromise } = require('../../config/db');

class AdminService {
  // Users
  static async getAllUsers() {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT Id, Name, Email, Role, LoyaltyPoints, CreatedAt FROM Users');
    return result.recordset;
  }

  static async updateUserRole(userId, role) {
    const pool = await getPool();
    await pool.request()
      .input('Id', sql.Int, userId)
      .input('Role', sql.NVarChar, role)
      .query('UPDATE Users SET Role=@Role WHERE Id=@Id');
    return { message: `✅ Đã cập nhật role user #${userId} thành ${role}` };
  }

  static async deleteUser(userId) {
    const pool = await getPool();
    await pool.request()
      .input('Id', sql.Int, userId)
      .query('DELETE FROM Users WHERE Id=@Id');
    return { message: `🗑️ Đã xóa user #${userId}` };
  }

  // Orders
  static async getAllOrders() {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM Orders ORDER BY CreatedAt DESC');
    return result.recordset;
  }

  static async updateOrderStatus(orderId, status) {
    const valid = ['pending', 'confirmed', 'processing', 'completed', 'cancelled'];
    if (!valid.includes(status)) throw new Error('Trạng thái không hợp lệ');

    const pool = await getPool();
    await pool.request()
      .input('Id', sql.Int, orderId)
      .input('Status', sql.NVarChar, status)
      .query('UPDATE Orders SET Status=@Status WHERE Id=@Id');
    return { message: `✅ Đơn #${orderId} cập nhật thành ${status}` };
  }

  // Inventory
  static async updateStock(productId, stock) {
    const pool = await getPool();
    await pool.request()
      .input('Id', sql.Int, productId)
      .input('Stock', sql.Int, stock)
      .query('UPDATE Products SET Stock=@Stock WHERE Id=@Id');
    return { message: `✅ Sản phẩm #${productId} cập nhật stock = ${stock}` };
  }
}

module.exports = AdminService;
