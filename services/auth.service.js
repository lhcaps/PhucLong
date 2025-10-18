// src/services/auth.service.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const dayjs = require("dayjs");
const { sql, getPool } = require("../config/db");
const UserModel = require("../models/user.model");
const EmailService = require("./email.service");
const TokenService = require("./token.service");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

class AuthService {
  // ======================
  // 1️⃣ ĐĂNG KÝ TÀI KHOẢN
  // ======================
  static async register({ Name, Email, Phone, Password }) {
    const existing = await UserModel.findByEmail(Email);
    if (existing) throw new Error("Email đã tồn tại");

    const hash = await bcrypt.hash(Password, 10);
    const verifyToken = uuidv4();
    const expires = dayjs().add(30, "minute").toDate();

    await UserModel.create({
      Name,
      Email,
      Phone,
      PasswordHash: hash,
      VerifyToken: verifyToken,
      VerifyTokenExpires: expires,
    });

    const verifyUrl = `${process.env.BACKEND_URL}/api/auth/verify-email?token=${verifyToken}`;
    try {
      await EmailService.sendVerificationEmail(Email, Name, verifyUrl);
    } catch (err) {
      console.error("❌ Gửi email xác minh thất bại:", err.message);
    }

    return "Vui lòng kiểm tra email để kích hoạt tài khoản";
  }

  // ======================
  // 2️⃣ XÁC NHẬN EMAIL
  // ======================
  static async verifyEmail(token) {
    const user = await UserModel.verifyAccount(token);
    if (!user) throw new Error("Liên kết không hợp lệ hoặc đã hết hạn");
    return { message: "Kích hoạt tài khoản thành công" };
  }

  // ======================
  // 3️⃣ ĐĂNG NHẬP
  // ======================
  static async login({ Email, Password }) {
    const user = await UserModel.findByEmail(Email);
    if (!user) throw new Error("Email chưa được đăng ký");
    if (!user.IsVerified) throw new Error("Tài khoản chưa được kích hoạt");

    const match = await bcrypt.compare(Password, user.PasswordHash);
    if (!match) throw new Error("Sai mật khẩu");

    const accessToken = await TokenService.signAccessToken({
      userId: user.Id,
      role: user.Role,
      email: user.Email,
    });
    const refreshToken = await TokenService.generateRefreshToken(user.Id);

    return {
      user: {
        id: user.Id,
        name: user.Name,
        email: user.Email,
        role: user.Role,
      },
      accessToken,
      refreshToken,
    };
  }

  // ======================
  // 4️⃣ QUÊN MẬT KHẨU
  // ======================
  static async forgotPassword(email) {
    const user = await UserModel.findByEmail(email);
    if (!user) return "Nếu email hợp lệ, hướng dẫn đã được gửi";

    // Tạo token & hash để lưu vào DB
    const rawToken = uuidv4();
    const hashedToken = await bcrypt.hash(rawToken, 10);
    const expires = dayjs().add(15, "minute").toDate();

    const pool = await getPool();
    await pool
      .request()
      .input("Id", sql.Int, user.Id)
      .input("ResetToken", sql.NVarChar, hashedToken)
      .input("ResetTokenExpires", sql.DateTime2, expires)
      .query(`
        UPDATE Users 
        SET ResetToken=@ResetToken, ResetTokenExpires=@ResetTokenExpires
        WHERE Id=@Id
      `);

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;
    try {
      await EmailService.sendResetPasswordEmail(user.Email, user.Name, resetUrl);
      console.log("📧 Đã gửi mail reset tới:", user.Email);
    } catch (err) {
      console.error("❌ Gửi email reset thất bại:", err.message);
    }

    return "Nếu email hợp lệ, hướng dẫn đã được gửi";
  }

  // ======================
  // 5️⃣ ĐẶT LẠI MẬT KHẨU
  // ======================
  static async resetPassword(token, newPassword) {
    const pool = await getPool();
    const now = new Date();

    // Lấy tất cả user có token chưa hết hạn
    const users = await pool
      .request()
      .input("Now", sql.DateTime2, now)
      .query("SELECT * FROM Users WHERE ResetTokenExpires >= @Now");

    let matchedUser = null;
    for (const u of users.recordset) {
      const ok = await bcrypt.compare(token, u.ResetToken || "");
      if (ok) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser)
      throw new Error("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");

    const hash = await bcrypt.hash(newPassword, 10);
    await pool
      .request()
      .input("Id", sql.Int, matchedUser.Id)
      .input("PasswordHash", sql.NVarChar, hash)
      .query(`
        UPDATE Users
        SET PasswordHash=@PasswordHash,
            ResetToken=NULL,
            ResetTokenExpires=NULL
        WHERE Id=@Id
      `);

    return "Đặt lại mật khẩu thành công";
  }

  // ======================
  // 6️⃣ LÀM MỚI TOKEN
  // ======================
  static async refreshToken(refreshToken) {
    const userId = await TokenService.verifyRefreshToken(refreshToken);
    const accessToken = await TokenService.signAccessToken({ userId });
    return { accessToken };
  }

  // ======================
  // 7️⃣ ĐĂNG XUẤT
  // ======================
  static async revokeRefreshToken(refreshToken) {
    await TokenService.revokeRefreshToken(refreshToken);
  }

  // ======================
  // 8️⃣ LẤY THÔNG TIN PROFILE
  // ======================
  static async getProfile(userId) {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error("Không tìm thấy người dùng");
    delete user.PasswordHash;
    return user;
  }

  // ======================
  // 9️⃣ CẬP NHẬT PROFILE
  // ======================
  static async updateProfile(userId, { Name, Phone }) {
    const pool = await getPool();
    await pool
      .request()
      .input("Id", sql.Int, userId)
      .input("Name", sql.NVarChar, Name)
      .input("Phone", sql.NVarChar, Phone)
      .query("UPDATE Users SET Name=@Name, Phone=@Phone WHERE Id=@Id");

    return "Cập nhật thông tin thành công";
  }

  // ======================
  // 🔟 ĐỔI MẬT KHẨU
  // ======================
  static async changePassword(userId, oldPassword, newPassword) {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error("Không tìm thấy người dùng");

    const match = await bcrypt.compare(oldPassword, user.PasswordHash);
    if (!match) throw new Error("Mật khẩu cũ không đúng");

    const hash = await bcrypt.hash(newPassword, 10);
    const pool = await getPool();
    await pool
      .request()
      .input("Id", sql.Int, userId)
      .input("PasswordHash", sql.NVarChar, hash)
      .query("UPDATE Users SET PasswordHash=@PasswordHash WHERE Id=@Id");

    return "Đổi mật khẩu thành công";
  }
}

module.exports = AuthService;
