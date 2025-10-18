// src/services/token.service.js
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const { sql, getPool } = require("../config/db");
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "7", 10);

const TokenService = {
  async signAccessToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  },

  async verifyAccessToken(token) {
    return jwt.verify(token, JWT_SECRET);
  },

  async generateRefreshToken(userId) {
    const rawToken = uuidv4() + "." + uuidv4();
    const hash = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 86400000);

    const pool = await getPool();
    await pool.request()
      .input("UserId", sql.Int, userId)
      .input("TokenHash", sql.NVarChar, hash)
      .input("ExpiresAt", sql.DateTime, expiresAt)
      .query(`
        INSERT INTO RefreshTokens (UserId, TokenHash, ExpiresAt)
        VALUES (@UserId, @TokenHash, @ExpiresAt)
      `);

    return rawToken;
  },

  async verifyRefreshToken(token) {
    const pool = await getPool();
    const tokens = await pool.request()
      .query("SELECT UserId, TokenHash, ExpiresAt FROM RefreshTokens");

    for (const row of tokens.recordset) {
      const valid = await bcrypt.compare(token, row.TokenHash);
      if (valid && new Date(row.ExpiresAt) > new Date()) return row.UserId;
    }
    throw new Error("Refresh token không hợp lệ hoặc đã hết hạn");
  },

  async revokeRefreshToken(token) {
    const pool = await getPool();
    const tokens = await pool.request().query("SELECT TokenHash FROM RefreshTokens");
    for (const row of tokens.recordset) {
      const valid = await bcrypt.compare(token, row.TokenHash);
      if (valid) {
        await pool.request()
          .input("TokenHash", sql.NVarChar, row.TokenHash)
          .query("DELETE FROM RefreshTokens WHERE TokenHash=@TokenHash");
        return;
      }
    }
  },

  async revokeAllUserTokens(userId) {
    const pool = await getPool();
    await pool.request().input("UserId", sql.Int, userId)
      .query("DELETE FROM RefreshTokens WHERE UserId=@UserId");
  }
};

module.exports = TokenService;
