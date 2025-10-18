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
  static async register({ Name, Email, Phone, Password }) {
    const pool = await getPool();
    const existing = await UserModel.findByEmail(Email);
    if (existing) throw new Error("Email đã tồn tại");

    const hash = await bcrypt.hash(Password, 10);
    const verifyToken = uuidv4();
    const expires = dayjs().add(30, "minute").toDate();

    await UserModel.create({ Name, Email, Phone, PasswordHash: hash, VerifyToken: verifyToken, VerifyTokenExpires: expires });

    const verifyUrl = `${process.env.BACKEND_URL}/api/auth/verify-email?token=${verifyToken}`;
    await EmailService.sendVerificationEmail(Email, Name, verifyUrl);
    return "Vui lòng kiểm tra email để kích hoạt tài khoản";
  }

  static async verifyEmail(token) {
    const user = await UserModel.verifyAccount(token);
    if (!user) throw new Error("Liên kết không hợp lệ hoặc đã hết hạn");
    return { message: "Kích hoạt tài khoản thành công" };
  }

  static async login({ Email, Password }) {
    const user = await UserModel.findByEmail(Email);
    if (!user || !user.IsVerified) throw new Error("Email chưa đăng ký hoặc chưa kích hoạt");
    const match = await bcrypt.compare(Password, user.PasswordHash);
    if (!match) throw new Error("Sai mật khẩu");

    const accessToken = await TokenService.signAccessToken({ userId: user.Id, role: user.Role, email: user.Email });
    const refreshToken = await TokenService.generateRefreshToken(user.Id);

    return {
      user: { id: user.Id, name: user.Name, email: user.Email, role: user.Role },
      accessToken,
      refreshToken,
    };
  }

  static async forgotPassword(email) {
    const user = await UserModel.findByEmail(email);
    if (!user) return "Nếu email hợp lệ, hướng dẫn đã được gửi";

    const resetToken = uuidv4();
    const expires = dayjs().add(15, "minute").toDate();
    const pool = await getPool();
    await pool.request()
      .input("Id", sql.Int, user.Id)
      .input("ResetToken", sql.NVarChar, resetToken)
      .input("ResetTokenExpires", sql.DateTime, expires)
      .query("UPDATE Users SET ResetToken=@ResetToken, ResetTokenExpires=@ResetTokenExpires WHERE Id=@Id");

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await EmailService.sendResetPasswordEmail(user.Email, user.Name, resetUrl);

    return "Nếu email hợp lệ, hướng dẫn đã được gửi";
  }

  static async resetPassword(token, newPassword) {
    const pool = await getPool();
    const now = new Date();
    const res = await pool.request()
      .input("Token", sql.NVarChar, token)
      .input("Now", sql.DateTime, now)
      .query(`
        SELECT * FROM Users WHERE ResetToken=@Token AND ResetTokenExpires>=@Now
      `);

    const user = res.recordset[0];
    if (!user) throw new Error("Liên kết không hợp lệ hoặc hết hạn");

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.request()
      .input("Id", sql.Int, user.Id)
      .input("PasswordHash", sql.NVarChar, hash)
      .query("UPDATE Users SET PasswordHash=@PasswordHash, ResetToken=NULL, ResetTokenExpires=NULL WHERE Id=@Id");

    return "Đặt lại mật khẩu thành công";
  }

  static async refreshToken(refreshToken) {
    const userId = await TokenService.verifyRefreshToken(refreshToken);
    const accessToken = await TokenService.signAccessToken({ userId });
    return { accessToken };
  }

  static async revokeRefreshToken(refreshToken) {
    await TokenService.revokeRefreshToken(refreshToken);
  }

  static async getProfile(userId) {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error("Không tìm thấy người dùng");
    return user;
  }

  static async updateProfile(userId, { Name, Phone }) {
    const pool = await getPool();
    await pool.request()
      .input("Id", sql.Int, userId)
      .input("Name", sql.NVarChar, Name)
      .input("Phone", sql.NVarChar, Phone)
      .query("UPDATE Users SET Name=@Name, Phone=@Phone WHERE Id=@Id");
  }

  static async changePassword(userId, oldPassword, newPassword) {
    const user = await UserModel.findById(userId);
    const match = await bcrypt.compare(oldPassword, user.PasswordHash);
    if (!match) throw new Error("Mật khẩu cũ không đúng");

    const hash = await bcrypt.hash(newPassword, 10);
    const pool = await getPool();
    await pool.request()
      .input("Id", sql.Int, userId)
      .input("PasswordHash", sql.NVarChar, hash)
      .query("UPDATE Users SET PasswordHash=@PasswordHash WHERE Id=@Id");
  }
}

module.exports = AuthService;
