const { sql, poolPromise } = require("../../config/db");

class AdminInventoryService {
  // ✅ Cập nhật số lượng tồn kho
  static async updateStock(productId, stock) {
    const pool = await getPool();
    await pool.request()
      .input("Id", sql.Int, productId)
      .input("Stock", sql.Int, stock)
      .query("UPDATE Products SET Stock = @Stock WHERE Id = @Id");
    return { message: `✅ Đã cập nhật tồn kho sản phẩm #${productId} = ${stock}` };
  }

  // ✅ Lịch sử nhập/xuất kho (nếu có bảng InventoryHistory)
  static async getHistory() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 50 ih.*, p.Name AS ProductName
      FROM InventoryHistory ih
      JOIN Products p ON ih.ProductId = p.Id
      ORDER BY ih.CreatedAt DESC
    `);
    return result.recordset;
  }
}

module.exports = AdminInventoryService;
