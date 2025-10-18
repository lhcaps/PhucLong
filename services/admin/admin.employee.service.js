const bcrypt = require("bcrypt");
const { sql, poolPromise } = require("../../config/db");

class AdminEmployeeService {
  static async getAll() {
    const pool = await getPool();
    const res = await pool.request().query(`
      SELECT e.Id, u.Name, u.Email, u.Phone, e.Position, e.Salary, e.Status, e.HireDate
      FROM Employees e
      JOIN Users u ON e.UserId = u.Id
      WHERE u.Role = 'employee'
    `);
    return res.recordset;
  }

  static async getById(id) {
    const pool = await getPool();
    const res = await pool.request()
      .input("Id", sql.Int, id)
      .query(`
        SELECT e.Id, u.Name, u.Email, u.Phone, e.Position, e.Salary, e.Status, e.HireDate
        FROM Employees e
        JOIN Users u ON e.UserId = u.Id
        WHERE e.Id = @Id
      `);
    if (!res.recordset.length) throw new Error("Không tìm thấy nhân viên");
    return res.recordset[0];
  }

  static async create({ Name, Email, Phone, Password, Position, Salary }) {
    const pool = await getPool();

    const exists = await pool.request()
      .input("Email", sql.NVarChar, Email)
      .query("SELECT Id FROM Users WHERE Email=@Email");
    if (exists.recordset.length) throw new Error("Email đã tồn tại");

    const hash = await bcrypt.hash(Password, 10);
    const userRes = await pool.request()
      .input("Name", sql.NVarChar, Name)
      .input("Email", sql.NVarChar, Email)
      .input("Phone", sql.NVarChar, Phone)
      .input("PasswordHash", sql.NVarChar, hash)
      .query(`
        INSERT INTO Users (Name, Email, Phone, PasswordHash, Role)
        OUTPUT INSERTED.Id
        VALUES (@Name, @Email, @Phone, @PasswordHash, 'employee')
      `);
    const userId = userRes.recordset[0].Id;

    await pool.request()
      .input("UserId", sql.Int, userId)
      .input("Position", sql.NVarChar, Position)
      .input("Salary", sql.Decimal(18, 2), Salary)
      .query(`
        INSERT INTO Employees (UserId, Position, Salary)
        VALUES (@UserId, @Position, @Salary)
      `);
    return { message: "✅ Đã thêm nhân viên mới" };
  }

  static async update(id, { Name, Phone, Position, Salary, Status }) {
    const pool = await getPool();
    await pool.request()
      .input("Id", sql.Int, id)
      .input("Name", sql.NVarChar, Name)
      .input("Phone", sql.NVarChar, Phone)
      .input("Position", sql.NVarChar, Position)
      .input("Salary", sql.Decimal(18, 2), Salary)
      .input("Status", sql.NVarChar, Status)
      .query(`
        UPDATE u
        SET u.Name=@Name, u.Phone=@Phone
        FROM Users u
        JOIN Employees e ON e.UserId = u.Id
        WHERE e.Id=@Id;

        UPDATE Employees
        SET Position=@Position, Salary=@Salary, Status=@Status
        WHERE Id=@Id;
      `);
    return { message: "✅ Cập nhật thông tin nhân viên thành công" };
  }

  static async delete(id) {
    const pool = await getPool();
    await pool.request().input("Id", sql.Int, id)
      .query("DELETE FROM Employees WHERE Id=@Id");
    return { message: "🗑️ Đã xóa nhân viên" };
  }
}

module.exports = AdminEmployeeService;
