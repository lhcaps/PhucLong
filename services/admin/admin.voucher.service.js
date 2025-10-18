// services/admin/admin.voucher.service.js
const { sql, poolPromise } = require("../../config/db");

class AdminVoucherService {
  // ✅ Danh sách tất cả vouchers (kèm thống kê lượt dùng)
  static async getAll() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        v.Id, v.Code, v.Type, v.Value, v.MaxDiscount, v.MinOrder,
        v.UsageLimit, v.UsedCount, v.IsActive,
        v.StartAt, v.EndAt, v.CreatedAt, v.UpdatedAt,
        COUNT(r.Id) AS RedemptionCount
      FROM Vouchers v
      LEFT JOIN VoucherRedemptions r ON v.Id = r.VoucherId
      GROUP BY 
        v.Id, v.Code, v.Type, v.Value, v.MaxDiscount, v.MinOrder,
        v.UsageLimit, v.UsedCount, v.IsActive, 
        v.StartAt, v.EndAt, v.CreatedAt, v.UpdatedAt
      ORDER BY v.CreatedAt DESC
    `);
    return result.recordset;
  }

  // ✅ Tạo mới voucher
  static async create(data) {
    const {
      Code, Type, Value, MaxDiscount, MinOrder,
      UsageLimit, StartAt, EndAt, IsActive = true
    } = data;

    if (!Code || !Type || !Value)
      throw new Error("Thiếu thông tin bắt buộc: Code, Type, Value");

    const pool = await getPool();
    await pool.request()
      .input("Code", sql.NVarChar, Code)
      .input("Type", sql.NVarChar, Type)
      .input("Value", sql.Decimal(18, 2), Value)
      .input("MaxDiscount", sql.Decimal(18, 2), MaxDiscount || null)
      .input("MinOrder", sql.Decimal(18, 2), MinOrder || null)
      .input("UsageLimit", sql.Int, UsageLimit || null)
      .input("IsActive", sql.Bit, IsActive ? 1 : 0)
      .input("StartAt", sql.DateTime2, StartAt || null)
      .input("EndAt", sql.DateTime2, EndAt || null)
      .query(`
        INSERT INTO Vouchers
        (Code, Type, Value, MaxDiscount, MinOrder, UsageLimit, UsedCount, IsActive, StartAt, EndAt, CreatedAt)
        VALUES (@Code, @Type, @Value, @MaxDiscount, @MinOrder, @UsageLimit, 0, @IsActive, @StartAt, @EndAt, SYSUTCDATETIME())
      `);

    return { message: "✅ Tạo voucher thành công" };
  }

  // ✅ Cập nhật voucher
  static async update(id, data) {
    if (!id) throw new Error("Thiếu voucher ID");

    const pool = await getPool();
    const request = pool.request()
      .input("Id", sql.Int, id)
      .input("Code", sql.NVarChar, data.Code)
      .input("Type", sql.NVarChar, data.Type)
      .input("Value", sql.Decimal(18, 2), data.Value)
      .input("MaxDiscount", sql.Decimal(18, 2), data.MaxDiscount || null)
      .input("MinOrder", sql.Decimal(18, 2), data.MinOrder || null)
      .input("UsageLimit", sql.Int, data.UsageLimit || null)
      .input("IsActive", sql.Bit, data.IsActive ? 1 : 0)
      .input("StartAt", sql.DateTime2, data.StartAt || null)
      .input("EndAt", sql.DateTime2, data.EndAt || null)
      .query(`
        UPDATE Vouchers
        SET Code=@Code, Type=@Type, Value=@Value, MaxDiscount=@MaxDiscount,
            MinOrder=@MinOrder, UsageLimit=@UsageLimit, IsActive=@IsActive,
            StartAt=@StartAt, EndAt=@EndAt, UpdatedAt=SYSUTCDATETIME()
        WHERE Id=@Id
      `);

    return { message: "✅ Cập nhật voucher thành công" };
  }

  // ✅ Vô hiệu hoá hoặc bật lại voucher
  static async toggleActive(id, isActive) {
    const pool = await getPool();
    await pool.request()
      .input("Id", sql.Int, id)
      .input("IsActive", sql.Bit, isActive ? 1 : 0)
      .query("UPDATE Vouchers SET IsActive=@IsActive, UpdatedAt=SYSUTCDATETIME() WHERE Id=@Id");

    return { message: isActive ? "Đã kích hoạt lại voucher" : "Đã vô hiệu hóa voucher" };
  }

  // ✅ Xoá voucher (nếu chưa có redemption)
  static async delete(id) {
    const pool = await getPool();
    const redemption = await pool.request()
      .input("Id", sql.Int, id)
      .query("SELECT COUNT(*) AS Cnt FROM VoucherRedemptions WHERE VoucherId=@Id");
    if (redemption.recordset[0].Cnt > 0)
      throw new Error("Voucher đã được sử dụng, không thể xoá");

    await pool.request().input("Id", sql.Int, id)
      .query("DELETE FROM Vouchers WHERE Id=@Id");

    return { message: "🗑️ Đã xoá voucher" };
  }

  // ✅ Thống kê tổng quan (dashboard)
  static async getStats() {
    const pool = await getPool();
    const stats = await pool.request().query(`
      SELECT
        COUNT(*) AS TotalVouchers,
        SUM(CASE WHEN IsActive=1 THEN 1 ELSE 0 END) AS ActiveVouchers,
        SUM(UsedCount) AS TotalUsed,
        SUM(CASE WHEN UsageLimit IS NOT NULL THEN UsageLimit ELSE 0 END) AS TotalLimit
      FROM Vouchers
    `);
    return stats.recordset[0];
  }
}

module.exports = AdminVoucherService;
