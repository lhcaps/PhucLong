const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sql, poolPromise } = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const { googleClient } = require("../config/google.config");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "7", 10);

class AuthService {
  // ===== ĐĂNG KÝ =====
  static async register({ Name, Email, Phone, Password }) {
    const pool = await poolPromise;
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
      .input("PasswordHash", sql.NVarChar, hash)
      .query(`
        INSERT INTO Users (Name, Email, Phone, PasswordHash, Role, GoogleLinked)
        VALUES (@Name, @Email, @Phone, @PasswordHash, 'customer', 0)
      `);

    return { message: "✅ Đăng ký thành công" };
  }

  // ===== ĐĂNG NHẬP =====
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

    return this._generateTokens(user);
  }

  // ===== ĐĂNG NHẬP GOOGLE =====
  static async loginWithGoogle(idToken) {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name } = payload;
    const pool = await poolPromise;

    let userRes = await pool
      .request()
      .input("Email", sql.NVarChar, email)
      .query("SELECT * FROM Users WHERE Email=@Email");

    if (!userRes.recordset.length) {
      await pool
        .request()
        .input("Name", sql.NVarChar, name)
        .input("Email", sql.NVarChar, email)
        .query(`
          INSERT INTO Users (Name, Email, Role, GoogleLinked)
          VALUES (@Name, @Email, 'customer', 1)
        `);
      userRes = await pool
        .request()
        .input("Email", sql.NVarChar, email)
        .query("SELECT * FROM Users WHERE Email=@Email");
    }

    const user = userRes.recordset[0];
    return this._generateTokens(user);
  }

  // ===== TOKEN =====
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
          .query("SELECT Id, Name, Email, Role FROM Users WHERE Id = @UserId");
        const user = userRes.recordset[0];
        return this._generateTokens(user, false);
      }
    }
    throw new Error("Refresh token không hợp lệ");
  }

  static async revokeRefreshToken(rawToken) {
    const pool = await poolPromise;
    const rows = await pool
      .request()
      .input("Now", sql.DateTime, new Date())
      .query("SELECT * FROM RefreshTokens WHERE ExpiresAt > @Now");

    for (const row of rows.recordset) {
      const match = await bcrypt.compare(rawToken, row.TokenHash);
      if (match) {
        await pool.request().input("Id", sql.Int, row.Id).query("DELETE FROM RefreshTokens WHERE Id = @Id");
        return true;
      }
    }
    return false;
  }

  // ===== PROFILE =====
  static async getProfile(userId) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("Id", sql.Int, userId)
      .query("SELECT Id, Name, Email, Role, LoyaltyPoints, Phone, GoogleLinked FROM Users WHERE Id=@Id");
    if (!result.recordset.length) throw new Error("User không tồn tại");
    return result.recordset[0];
  }

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

  static async changePassword(userId, oldPassword, newPassword) {
    const pool = await poolPromise;
    const res = await pool.request().input("Id", sql.Int, userId).query("SELECT PasswordHash FROM Users WHERE Id=@Id");
    if (!res.recordset.length) throw new Error("User không tồn tại");
    const user = res.recordset[0];

    const match = await bcrypt.compare(oldPassword, user.PasswordHash);
    if (!match) throw new Error("Mật khẩu cũ không đúng");
    if (newPassword.length < 6) throw new Error("Mật khẩu mới phải ≥ 6 ký tự");

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.request().input("Id", sql.Int, userId).input("PasswordHash", sql.NVarChar, hash)
      .query("UPDATE Users SET PasswordHash=@PasswordHash WHERE Id=@Id");

    return { message: "✅ Đổi mật khẩu thành công" };
  }

  // ===== FORGOT PASSWORD =====
  static async forgotPassword(email) {
    const pool = await poolPromise;
    const res = await pool
      .request()
      .input("Email", sql.NVarChar, email)
      .query("SELECT Id, Name, GoogleLinked FROM Users WHERE Email=@Email");

    if (!res.recordset.length) throw new Error("Không tìm thấy email");
    const user = res.recordset[0];

    // Nếu là tài khoản Google-linked
    if (user.GoogleLinked) {
      await this._sendMail(email, "🔑 Đặt lại mật khẩu Google", `
        Xin chào ${user.Name},<br/>
        Tài khoản của bạn đăng nhập bằng Google.<br/>
        Hãy thay đổi mật khẩu tại: <a href="https://myaccount.google.com/security">Trang bảo mật Google</a>.
      `);
      return "Email hướng dẫn đã được gửi đến tài khoản Google.";
    }

    // Nếu là local account
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "15m" });
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    await pool
      .request()
      .input("Email", sql.NVarChar, email)
      .input("Token", sql.NVarChar, token)
      .input("Expiry", sql.DateTime, expiry)
      .query("UPDATE Users SET ResetToken=@Token, ResetTokenExpiry=@Expiry WHERE Email=@Email");

    const link = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    await this._sendMail(email, "🔑 Đặt lại mật khẩu", `
      Xin chào ${user.Name},<br/>
      Nhấn vào link sau để đặt lại mật khẩu (hết hạn sau 15 phút):<br/>
      <a href="${link}">${link}</a>
    `);

    return "Email đặt lại mật khẩu đã được gửi.";
  }

  static async resetPassword(token, newPassword) {
    try {
      const { email } = jwt.verify(token, JWT_SECRET);
      const pool = await poolPromise;
      const res = await pool
        .request()
        .input("Email", sql.NVarChar, email)
        .query("SELECT ResetTokenExpiry FROM Users WHERE Email=@Email");

      if (!res.recordset.length) throw new Error("Email không tồn tại");
      const { ResetTokenExpiry } = res.recordset[0];
      if (new Date(ResetTokenExpiry) < new Date()) throw new Error("Token đã hết hạn");

      const hash = await bcrypt.hash(newPassword, 10);
      await pool
        .request()
        .input("Email", sql.NVarChar, email)
        .input("PasswordHash", sql.NVarChar, hash)
        .query("UPDATE Users SET PasswordHash=@PasswordHash, ResetToken=NULL, ResetTokenExpiry=NULL WHERE Email=@Email");

      return "✅ Đặt lại mật khẩu thành công!";
    } catch (err) {
      throw new Error("Token không hợp lệ hoặc đã hết hạn");
    }
  }

  // ===== UTILS =====
  static async _generateTokens(user, includeRefresh = true) {
    const payload = { userId: user.Id, role: user.Role, email: user.Email };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    if (!includeRefresh) return { accessToken, user };

    const pool = await poolPromise;
    const rawRefreshToken = uuidv4() + "." + uuidv4();
    const refreshHash = await bcrypt.hash(rawRefreshToken, 10);
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

    await pool
      .request()
      .input("UserId", sql.Int, user.Id)
      .input("TokenHash", sql.NVarChar, refreshHash)
      .input("ExpiresAt", sql.DateTime, expiresAt)
      .query("INSERT INTO RefreshTokens (UserId, TokenHash, ExpiresAt) VALUES (@UserId, @TokenHash, @ExpiresAt)");

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.Id,
        name: user.Name,
        email: user.Email,
        role: user.Role,
        googleLinked: user.GoogleLinked || 0,
      },
    };
  }

  static async _sendMail(to, subject, html) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });
    await transporter.sendMail({ from: `"PhucLong Support" <${process.env.MAIL_USER}>`, to, subject, html });
  }
}

module.exports = AuthService;
