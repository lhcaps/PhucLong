const { sql, poolPromise } = require("../../config/db");

class AdminProductService {
  // Lấy danh sách sản phẩm
  static async getAll() {
    const pool = await getPool();
    const res = await pool.request()
      .query("SELECT Id, Name, Price, Stock, CategoryId, ImageUrl FROM Products ORDER BY CreatedAt DESC");
    return res.recordset;
  }

  // Lấy chi tiết sản phẩm
  static async getById(id) {
    const pool = await getPool();
    const res = await pool.request().input("Id", sql.Int, id)
      .query("SELECT * FROM Products WHERE Id=@Id");
    if (!res.recordset.length) throw new Error("Không tìm thấy sản phẩm");
    return res.recordset[0];
  }

  // Tạo sản phẩm
  static async create({ Name, Description, Price, Stock, CategoryId, ImageUrl }) {
    const pool = await getPool();
    await pool.request()
      .input("Name", sql.NVarChar, Name)
      .input("Description", sql.NVarChar, Description)
      .input("Price", sql.Decimal(18, 2), Price)
      .input("Stock", sql.Int, Stock)
      .input("CategoryId", sql.Int, CategoryId)
      .input("ImageUrl", sql.NVarChar, ImageUrl)
      .query(`
        INSERT INTO Products (Name, Description, Price, Stock, CategoryId, ImageUrl)
        VALUES (@Name, @Description, @Price, @Stock, @CategoryId, @ImageUrl)
      `);
    return { message: "✅ Đã thêm sản phẩm mới" };
  }

  // Cập nhật sản phẩm
  static async update(id, { Name, Description, Price, Stock, CategoryId, ImageUrl }) {
    const pool = await getPool();
    await pool.request()
      .input("Id", sql.Int, id)
      .input("Name", sql.NVarChar, Name)
      .input("Description", sql.NVarChar, Description)
      .input("Price", sql.Decimal(18, 2), Price)
      .input("Stock", sql.Int, Stock)
      .input("CategoryId", sql.Int, CategoryId)
      .input("ImageUrl", sql.NVarChar, ImageUrl)
      .query(`
        UPDATE Products
        SET Name=@Name, Description=@Description, Price=@Price, Stock=@Stock,
            CategoryId=@CategoryId, ImageUrl=@ImageUrl
        WHERE Id=@Id
      `);
    return { message: "✅ Cập nhật sản phẩm thành công" };
  }

  // Xóa sản phẩm
  static async delete(id) {
    const pool = await getPool();
    await pool.request().input("Id", sql.Int, id)
      .query("DELETE FROM Products WHERE Id=@Id");
    return { message: "🗑️ Đã xóa sản phẩm" };
  }
}

module.exports = AdminProductService;
