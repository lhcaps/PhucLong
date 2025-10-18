// src/models/category.model.js
const { sql, getPool } = require("../config/db");


class CategoryModel {
  static async getAll() {
    const pool = await getPool();
    const res = await pool.request().query("SELECT * FROM Categories ORDER BY Name ASC");
    return res.recordset;
  }

  static async getById(id) {
    const pool = await getPool();
    const res = await pool
      .request()
      .input("Id", sql.Int, id)
      .query("SELECT * FROM Categories WHERE Id=@Id");
    return res.recordset[0] || null;
  }

  static async create(name) {
    const pool = await getPool();
    const res = await pool
      .request()
      .input("Name", sql.NVarChar, name)
      .query(`
        INSERT INTO Categories (Name)
        OUTPUT INSERTED.*
        VALUES (@Name)
      `);
    return res.recordset[0];
  }

  static async update(id, name) {
    const pool = await getPool();
    const res = await pool
      .request()
      .input("Id", sql.Int, id)
      .input("Name", sql.NVarChar, name)
      .query(`
        UPDATE Categories
        SET Name=@Name
        OUTPUT INSERTED.*
        WHERE Id=@Id
      `);
    return res.recordset[0];
  }

  static async delete(id) {
    const pool = await getPool();
    await pool.request().input("Id", sql.Int, id).query("DELETE FROM Categories WHERE Id=@Id");
  }
}

module.exports = CategoryModel;
