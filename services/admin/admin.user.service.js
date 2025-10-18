const { sql, poolPromise } = require("../../config/db");

class AdminUserService {
  static async getAll() {
    const pool = await getPool();
    const res = await pool.request()
      .query("SELECT Id, Name, Email, Role, LoyaltyPoints, CreatedAt FROM Users");
    return res.recordset;
  }

  static async updateRole(userId, role) {
    const pool = await getPool();
    await pool.request()
      .input("Id", sql.Int, userId)
      .input("Role", sql.NVarChar, role)
      .query("UPDATE Users SET Role=@Role WHERE Id=@Id");
    return { message: `✅ Đã cập nhật role user #${userId} thành ${role}` };
  }

  static async delete(userId) {
    const pool = await getPool();
    await pool.request().input("Id", sql.Int, userId)
      .query("DELETE FROM Users WHERE Id=@Id");
    return { message: `🗑️ Đã xóa user #${userId}` };
  }
}

module.exports = AdminUserService;
