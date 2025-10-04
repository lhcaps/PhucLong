const { sql, poolPromise } = require("../config/db");

class CategoryService {
  static async getAll() {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query("SELECT * FROM Categories ORDER BY Name ASC");
    return result.recordset;
  }

  static async getById(id) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("Id", sql.Int, id)
      .query("SELECT * FROM Categories WHERE Id=@Id");
    return result.recordset[0] || null;
  }

  static async create(name) {
    const pool = await poolPromise;
    await pool
      .request()
      .input("Name", sql.NVarChar, name)
      .query("INSERT INTO Categories (Name) VALUES (@Name)");
    return { message: "✅ Đã thêm danh mục" };
  }

  static async update(id, name) {
    const pool = await poolPromise;
    await pool
      .request()
      .input("Id", sql.Int, id)
      .input("Name", sql.NVarChar, name)
      .query("UPDATE Categories SET Name=@Name WHERE Id=@Id");
    return { message: "✅ Đã cập nhật danh mục" };
  }

  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input("Id", sql.Int, id)
      .query("DELETE FROM Categories WHERE Id=@Id");
    return { message: "✅ Đã xóa danh mục" };
  }

  // Lấy lịch sử điểm của user
  static async getTransactions(userId) {
    const pool = await poolPromise;
    const result = await pool.request().input("UserId", sql.Int, userId).query(`
      SELECT Id, OrderId, Points, Note, CreatedAt
      FROM LoyaltyTransactions
      WHERE UserId=@UserId
      ORDER BY CreatedAt DESC
    `);
    return result.recordset;
  }
}

module.exports = CategoryService;
