// src/models/token.model.js
const { sql, getPool } = require("../config/db");

const TokenModel = {
  async addRefreshToken({ userId, refreshToken, expiresAt }) {
    const pool = await getPool();
    await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("RefreshToken", sql.NVarChar, refreshToken)
      .input("ExpiresAt", sql.DateTime2, expiresAt)
      .query(`
        INSERT INTO dbo.UserTokens(UserId, RefreshToken, ExpiresAt)
        VALUES (@UserId, @RefreshToken, @ExpiresAt)
      `);
  },

  async findRefreshToken(refreshToken) {
    const pool = await getPool();
    const now = new Date();
    const q = await pool
      .request()
      .input("RefreshToken", sql.NVarChar, refreshToken)
      .input("Now", sql.DateTime2, now)
      .query(`
        SELECT TOP 1 * FROM dbo.UserTokens
        WHERE RefreshToken = @RefreshToken AND ExpiresAt >= @Now
      `);
    return q.recordset[0] || null;
  },

  async removeRefreshToken(refreshToken) {
    const pool = await getPool();
    await pool
      .request()
      .input("RefreshToken", sql.NVarChar, refreshToken)
      .query(`DELETE FROM dbo.UserTokens WHERE RefreshToken = @RefreshToken`);
  },

  async removeAllForUser(userId) {
    const pool = await getPool();
    await pool
      .request()
      .input("UserId", sql.Int, userId)
      .query(`DELETE FROM dbo.UserTokens WHERE UserId = @UserId`);
  },
};

module.exports = TokenModel;
