const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const { sql, poolPromise } = require("../config/db");
const { googleClient } = require("../config/google.config");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "7", 10);

class AuthService {
  // ===== ĐĂNG KÝ =====
  static async register({ Name, Email, Phone, Password }) {
    const pool = await poolPromise;

    const exists = await pool.request()
      .input("Email", sql.NVarChar, Email)
      .query("SELECT Id FROM Users WHERE Email=@Email");
    if (exists.recordset.length) throw new Error("Email đã tồn tại");

    if (Password.length < 6) throw new Error("Mật khẩu phải ≥ 6 ký tự");
    const hash = await bcrypt.hash(Password, 10);

    await pool.request()
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
    const res = await pool.request()
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
    const { sub, email, name, email_verified } = payload;

    if (!email_verified) throw new Error("Email Google chưa được xác minh");

    const pool = await poolPromise;
    let userRes = await pool.request()
      .input("Email", sql.NVarChar, email)
      .query("SELECT * FROM Users WHERE Email=@Email");

    // Nếu chưa có user -> tạo mới
    if (!userRes.recordset.length) {
      await pool.request()
        .input("Name", sql.NVarChar, name)
        .input("Email", sql.NVarChar, email)
        .input("Role", sql.NVarChar, "customer")
        .input("GoogleLinked", sql.Bit, 1)
        .input("GoogleSub", sql.NVarChar, sub)
        .query(`
          INSERT INTO Users (Name, Email, Role, GoogleLinked, GoogleSub)
          VALUES (@Name, @Email, @Role, @GoogleLinked, @GoogleSub)
        `);

      userRes = await pool.request()
        .input("Email", sql.NVarChar, email)
        .query("SELECT * FROM Users WHERE Email=@Email");
    }

    const user = userRes.recordset[0];
    return this._generateTokens(user);
  }

  // ===== FORGOT PASSWORD =====
  static async forgotPassword(email) {
    const pool = await poolPromise;
    const res = await pool.request()
      .input("Email", sql.NVarChar, email)
      .query("SELECT Id, Name FROM Users WHERE Email=@Email");

    const msg = "Nếu email hợp lệ, chúng tôi đã gửi hướng dẫn khôi phục.";
    if (!res.recordset.length) return msg;

    const user = res.recordset[0];
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "15m" });
    const expiry = new Date(Date.now() + 15 * 60 * 1000);
    const tokenHash = await bcrypt.hash(token, 10);

    await pool.request()
      .input("Email", sql.NVarChar, email)
      .input("ResetTokenHash", sql.NVarChar, tokenHash)
      .input("ResetTokenExpiry", sql.DateTime, expiry)
      .query(`
        UPDATE Users SET ResetTokenHash=@ResetTokenHash, ResetTokenExpiry=@ResetTokenExpiry WHERE Email=@Email
      `);

    const link = `${process.env.FRONTEND_URL}/reset-password/${encodeURIComponent(token)}`;
    await this._sendMail(email, "🔑 Đặt lại mật khẩu tài khoản PhucLong", `
      Xin chào ${user.Name},<br/>
      Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản PhucLong.<br/>
      Nhấn vào liên kết bên dưới để đặt lại (hết hạn sau 15 phút):<br/>
      <a href="${link}">${link}</a>
    `);

    return msg;
  }

  // ===== RESET PASSWORD =====
  static async resetPassword(token, newPassword) {
    try {
      const { email } = jwt.verify(token, JWT_SECRET);
      const pool = await poolPromise;
      const res = await pool.request()
        .input("Email", sql.NVarChar, email)
        .query("SELECT ResetTokenHash, ResetTokenExpiry FROM Users WHERE Email=@Email");

      if (!res.recordset.length) throw new Error("Email không tồn tại");
      const { ResetTokenHash, ResetTokenExpiry } = res.recordset[0];
      if (new Date(ResetTokenExpiry) < new Date()) throw new Error("Link đã hết hạn");

      const valid = await bcrypt.compare(token, ResetTokenHash);
      if (!valid) throw new Error("Link không hợp lệ");

      const hash = await bcrypt.hash(newPassword, 10);
      await pool.request()
        .input("Email", sql.NVarChar, email)
        .input("PasswordHash", sql.NVarChar, hash)
        .query(`
          UPDATE Users SET PasswordHash=@PasswordHash, ResetTokenHash=NULL, ResetTokenExpiry=NULL WHERE Email=@Email
        `);

      return "✅ Đặt lại mật khẩu thành công!";
    } catch (err) {
      throw new Error("Token không hợp lệ hoặc đã hết hạn");
    }
  }

  // ===== TOKEN =====
  static async _generateTokens(user, includeRefresh = true) {
    const payload = { userId: user.Id, role: user.Role, email: user.Email };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    if (!includeRefresh) return { accessToken, user };

    const pool = await poolPromise;
    const rawRefreshToken = uuidv4() + "." + uuidv4();
    const refreshHash = await bcrypt.hash(rawRefreshToken, 10);
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 86400000);

    await pool.request()
      .input("UserId", sql.Int, user.Id)
      .input("TokenHash", sql.NVarChar, refreshHash)
      .input("ExpiresAt", sql.DateTime, expiresAt)
      .query(`
        INSERT INTO RefreshTokens (UserId, TokenHash, ExpiresAt)
        VALUES (@UserId, @TokenHash, @ExpiresAt)
      `);

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

  // ===== GỬI EMAIL =====
  static async _sendMail(to, subject, html) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"PhucLong Support" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
    });
  }
}

module.exports = AuthService;
