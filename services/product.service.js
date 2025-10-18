const { sql, getPool } = require("../config/db");
const Product = require("../models/product.model");

class ProductService {
  static async getAll(filters = {}) {
    const { categoryId, sort, bestseller } = filters;
    const pool = await getPool();

    let query = "SELECT * FROM Products WHERE 1=1";
    if (categoryId) query += " AND CategoryId=@CategoryId";
    if (bestseller) query += " AND Bestseller=1";

    // Sort: price_asc, price_desc, newest
    if (sort === "price_asc") query += " ORDER BY Price ASC";
    else if (sort === "price_desc") query += " ORDER BY Price DESC";
    else query += " ORDER BY Id DESC"; // default

    const request = pool.request();
    if (categoryId) request.input("CategoryId", sql.Int, categoryId);

    const result = await request.query(query);
    return result.recordset.map((row) => new Product(row));
  }

  static async getById(id) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Id", sql.Int, id)
      .query("SELECT * FROM Products WHERE Id = @Id");
    return result.recordset[0] ? new Product(result.recordset[0]) : null;
  }

  static async create(data) {
    const pool = await getPool();
    await pool
      .request()
      .input("Name", sql.NVarChar, data.Name)
      .input("Description", sql.NVarChar, data.Description)
      .input("Price", sql.Decimal(10, 2), data.Price)
      .input("ImageUrl", sql.NVarChar, data.ImageUrl)
      .input("Stock", sql.Int, data.Stock || 100)
      .input("CategoryId", sql.Int, data.CategoryId).query(`
        INSERT INTO Products (Name, Description, Price, ImageUrl, Stock, CategoryId)
        VALUES (@Name, @Description, @Price, @ImageUrl, @Stock, @CategoryId)
      `);
    return { message: "✅ Đã thêm sản phẩm" };
  }

  static async update(id, data) {
    const pool = await getPool();
    await pool
      .request()
      .input("Id", sql.Int, id)
      .input("Name", sql.NVarChar, data.Name)
      .input("Description", sql.NVarChar, data.Description)
      .input("Price", sql.Decimal(10, 2), data.Price)
      .input("ImageUrl", sql.NVarChar, data.ImageUrl)
      .input("Stock", sql.Int, data.Stock)
      .input("CategoryId", sql.Int, data.CategoryId).query(`
        UPDATE Products
        SET Name=@Name, Description=@Description, Price=@Price, ImageUrl=@ImageUrl, Stock=@Stock, CategoryId=@CategoryId
        WHERE Id=@Id
      `);
    return { message: "✅ Đã cập nhật sản phẩm" };
  }

  static async delete(id) {
    const pool = await getPool();
    await pool
      .request()
      .input("Id", sql.Int, id)
      .query("DELETE FROM Products WHERE Id=@Id");
    return { message: "✅ Đã xóa sản phẩm" };
  }
}

module.exports = ProductService;
