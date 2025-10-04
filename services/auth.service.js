const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sql, poolPromise } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "7", 10);

class AuthService {
  // Đăng ký
  static async register({ Name, Email, Phone, Password }) {
    const pool = await poolPromise;

    // Check email tồn tại
    const exists = await pool
      .request()
      .input("Email", sql.NVarChar, Email)
      .query("SELECT Id FROM Users WHERE Email = @Email");
    if (exists.recordset.length) throw new Error("Email đã tồn tại");

    if (Password.length < 6) throw new Error("Mật khẩu phải ≥ 6 ký tự");

    const hash = await bcrypt.hash(Password, 10);

    await pool
      .request()
      .input("Name", sql.NVarChar, Name)
      .input("Email", sql.NVarChar, Email)
      .input("Phone", sql.NVarChar, Phone)
      .input("PasswordHash", sql.NVarChar, hash).query(`
        INSERT INTO Users (Name, Email, Phone, PasswordHash)
        VALUES (@Name, @Email, @Phone, @PasswordHash)
      `);

    return { message: "✅ Đăng ký thành công" };
  }

  // Đăng nhập
  static async login({ Email, Password }) {
    const pool = await poolPromise;
    const res = await pool
      .request()
      .input("Email", sql.NVarChar, Email)
      .query("SELECT * FROM Users WHERE Email=@Email");

    if (!res.recordset.length) throw new Error("Email hoặc mật khẩu không đúng");
    const user = res.recordset[0];

    const match = await bcrypt.compare(Password, user.PasswordHash);
    if (!match) throw new Error("Email hoặc mật khẩu không đúng");

    // Access token
    const payload = { userId: user.Id, role: user.Role, email: user.Email };
    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    // Refresh token
    const rawRefreshToken = uuidv4() + "." + uuidv4();
    const refreshHash = await bcrypt.hash(rawRefreshToken, 10);
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

    await pool
      .request()
      .input("UserId", sql.Int, user.Id)
      .input("TokenHash", sql.NVarChar, refreshHash)
      .input("ExpiresAt", sql.DateTime, expiresAt).query(`
        INSERT INTO RefreshTokens (UserId, TokenHash, ExpiresAt)
        VALUES (@UserId, @TokenHash, @ExpiresAt)
      `);

    // 👉 Trả cả thông tin user cho FE
    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresAt,
      user: {
        id: user.Id,
        name: user.Name,
        email: user.Email,
        role: user.Role,
        loyaltyPoints: user.LoyaltyPoints,
      },
    };
  }

  // Refresh token
  static async refreshToken(rawToken) {
    const pool = await poolPromise;

    const rows = await pool
      .request()
      .input("Now", sql.DateTime, new Date())
      .query("SELECT * FROM RefreshTokens WHERE ExpiresAt > @Now");

    for (const row of rows.recordset) {
      const match = await bcrypt.compare(rawToken, row.TokenHash);
      if (match) {
        const userRes = await pool
          .request()
          .input("UserId", sql.Int, row.UserId)
          .query("SELECT Id, Name, Email, Role, LoyaltyPoints FROM Users WHERE Id = @UserId");

        const user = userRes.recordset[0];
        if (!user) throw new Error("User không tồn tại");

        const payload = { userId: user.Id, role: user.Role, email: user.Email };
        const accessToken = jwt.sign(payload, JWT_SECRET, {
          expiresIn: JWT_EXPIRES_IN,
        });

        return { accessToken, user };
      }
    }
    throw new Error("Refresh token không hợp lệ");
  }

  // Logout
  static async revokeRefreshToken(rawToken) {
    const pool = await poolPromise;

    const rows = await pool
      .request()
      .input("Now", sql.DateTime, new Date())
      .query("SELECT * FROM RefreshTokens WHERE ExpiresAt > @Now");

    for (const row of rows.recordset) {
      const match = await bcrypt.compare(rawToken, row.TokenHash);
      if (match) {
        await pool
          .request()
          .input("Id", sql.Int, row.Id)
          .query("DELETE FROM RefreshTokens WHERE Id = @Id");
        return true;
      }
    }
    return false;
  }

  // Profile
  static async getProfile(userId) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("Id", sql.Int, userId)
      .query("SELECT Id, Name, Email, Role, LoyaltyPoints, Phone FROM Users WHERE Id=@Id");

    if (!result.recordset.length) throw new Error("User không tồn tại");
    return result.recordset[0];
  }

  // Update profile
  static async updateProfile(userId, { Name, Phone }) {
    const pool = await poolPromise;
    await pool
      .request()
      .input("Id", sql.Int, userId)
      .input("Name", sql.NVarChar, Name)
      .input("Phone", sql.NVarChar, Phone)
      .query("UPDATE Users SET Name=@Name, Phone=@Phone WHERE Id=@Id");

    return { message: "✅ Cập nhật hồ sơ thành công" };
  }

  // Change password
  static async changePassword(userId, oldPassword, newPassword) {
    const pool = await poolPromise;
    const res = await pool
      .request()
      .input("Id", sql.Int, userId)
      .query("SELECT PasswordHash FROM Users WHERE Id=@Id");

    if (!res.recordset.length) throw new Error("User không tồn tại");
    const user = res.recordset[0];

    const match = await bcrypt.compare(oldPassword, user.PasswordHash);
    if (!match) throw new Error("Mật khẩu cũ không đúng");

    if (newPassword.length < 6) throw new Error("Mật khẩu mới phải ≥ 6 ký tự");

    const hash = await bcrypt.hash(newPassword, 10);
    await pool
      .request()
      .input("Id", sql.Int, userId)
      .input("PasswordHash", sql.NVarChar, hash)
      .query("UPDATE Users SET PasswordHash=@PasswordHash WHERE Id=@Id");

    return { message: "✅ Đổi mật khẩu thành công" };
  }
}

module.exports = AuthService;
