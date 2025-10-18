// src/models/user.model.js
const { sql, getPool } = require("../config/db");


const UserModel = {
  async findByEmail(email) {
    const pool = await getPool();
    const res = await pool.request()
      .input("Email", sql.NVarChar, email)
      .query("SELECT * FROM Users WHERE Email=@Email");
    return res.recordset[0] || null;
  },

  async findById(id) {
    const pool = await getPool();
    const res = await pool.request()
      .input("Id", sql.Int, id)
      .query("SELECT * FROM Users WHERE Id=@Id");
    return res.recordset[0] || null;
  },

  async create({ Name, Email, Phone, PasswordHash, VerifyToken, VerifyTokenExpires }) {
    const pool = await getPool();
    await pool.request()
      .input("Name", sql.NVarChar, Name)
      .input("Email", sql.NVarChar, Email)
      .input("Phone", sql.NVarChar, Phone)
      .input("PasswordHash", sql.NVarChar, PasswordHash)
      .input("IsVerified", sql.Bit, 0)
      .input("VerifyToken", sql.NVarChar, VerifyToken)
      .input("VerifyTokenExpires", sql.DateTime, VerifyTokenExpires)
      .query(`
        INSERT INTO Users (Name, Email, Phone, PasswordHash, IsVerified, VerifyToken, VerifyTokenExpires, Role)
        VALUES (@Name, @Email, @Phone, @PasswordHash, @IsVerified, @VerifyToken, @VerifyTokenExpires, 'customer')
      `);
  },

  async verifyAccount(token) {
    const pool = await getPool();
    const now = new Date();
    const res = await pool.request()
      .input("Token", sql.NVarChar, token)
      .input("Now", sql.DateTime, now)
      .query(`
        UPDATE Users
        SET IsVerified=1, VerifyToken=NULL, VerifyTokenExpires=NULL
        OUTPUT INSERTED.*
        WHERE VerifyToken=@Token AND VerifyTokenExpires>=@Now
      `);
    return res.recordset[0] || null;
  },
};

module.exports = UserModel;
