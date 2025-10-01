// services/auth.service.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sql, poolPromise } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);

class AuthService {
  static async register({ Name, Email, Phone, Password }) {
    const pool = await poolPromise;
    // check email exists
    const exists = await pool.request()
      .input('Email', sql.NVarChar, Email)
      .query('SELECT Id FROM Users WHERE Email = @Email');
    if (exists.recordset.length) throw new Error('Email đã tồn tại');

    const saltRounds = 10;
    const hash = await bcrypt.hash(Password, saltRounds);

    await pool.request()
      .input('Name', sql.NVarChar, Name)
      .input('Email', sql.NVarChar, Email)
      .input('Phone', sql.NVarChar, Phone)
      .input('PasswordHash', sql.NVarChar, hash)
      .query(`
        INSERT INTO Users (Name, Email, Phone, PasswordHash)
        VALUES (@Name, @Email, @Phone, @PasswordHash)
      `);

    return { message: 'Đăng ký thành công' };
  }

  static async login({ Email, Password }) {
    const pool = await poolPromise;
    const res = await pool.request()
      .input('Email', sql.NVarChar, Email)
      .query('SELECT * FROM Users WHERE Email=@Email');
    if (!res.recordset.length) throw new Error('Email hoặc mật khẩu không đúng');

    const user = res.recordset[0];
    const match = await bcrypt.compare(Password, user.PasswordHash);
    if (!match) throw new Error('Email hoặc mật khẩu không đúng');

    // Tạo access token
    const payload = { userId: user.Id, role: user.Role, email: user.Email };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Tạo refresh token (raw) và lưu hash vào DB
    const rawRefreshToken = uuidv4() + '.' + uuidv4(); // random
    const refreshHash = await bcrypt.hash(rawRefreshToken, 10);
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

    await pool.request()
      .input('UserId', sql.Int, user.Id)
      .input('TokenHash', sql.NVarChar, refreshHash)
      .input('ExpiresAt', sql.DateTime, expiresAt)
      .query(`
        INSERT INTO RefreshTokens (UserId, TokenHash, ExpiresAt)
        VALUES (@UserId, @TokenHash, @ExpiresAt)
      `);

    return { accessToken, refreshToken: rawRefreshToken, expiresAt };
  }

  static async refreshToken(rawToken) {
    const pool = await poolPromise;
    // get candidate tokens (not expired)
    const rows = await pool.request()
      .input('Now', sql.DateTime, new Date())
      .query('SELECT * FROM RefreshTokens WHERE ExpiresAt > @Now');

    for (const row of rows.recordset) {
      const match = await bcrypt.compare(rawToken, row.TokenHash);
      if (match) {
        // token valid
        // issue new access token (based on user)
        const userRes = await pool.request()
          .input('UserId', sql.Int, row.UserId)
          .query('SELECT Id, Email, Role FROM Users WHERE Id = @UserId');
        const user = userRes.recordset[0];
        if (!user) throw new Error('User không tồn tại');

        const payload = { userId: user.Id, role: user.Role, email: user.Email };
        const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        return { accessToken };
      }
    }
    throw new Error('Refresh token không hợp lệ');
  }

  static async revokeRefreshToken(rawToken) {
    const pool = await poolPromise;
    // find and delete matching hashed token(s)
    const rows = await pool.request()
      .input('Now', sql.DateTime, new Date())
      .query('SELECT * FROM RefreshTokens WHERE ExpiresAt > @Now');

    for (const row of rows.recordset) {
      const match = await bcrypt.compare(rawToken, row.TokenHash);
      if (match) {
        await pool.request()
          .input('Id', sql.Int, row.Id)
          .query('DELETE FROM RefreshTokens WHERE Id = @Id');
        return true;
      }
    }
    return false;
  }
}

module.exports = AuthService;
