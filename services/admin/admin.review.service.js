// services/admin/admin.review.service.js
const { sql, poolPromise } = require("../../config/db");

class AdminReviewService {
  // ✅ Danh sách tất cả review (kèm thông tin user & sản phẩm)
  static async getAll() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        pr.Id, pr.ProductId, p.Name AS ProductName,
        pr.UserId, u.Name AS UserName, u.Email,
        pr.Rating, pr.Comment, pr.IsVisible,
        pr.CreatedAt, pr.UpdatedAt
      FROM ProductReviews pr
      JOIN Users u ON pr.UserId = u.Id
      JOIN Products p ON pr.ProductId = p.Id
      ORDER BY pr.CreatedAt DESC
    `);
    return result.recordset;
  }

  // ✅ Cập nhật review (Admin có thể sửa rating/comment/visibility)
  static async update(id, data) {
    const pool = await getPool();
    const req = pool.request().input("Id", sql.Int, id);

    const set = [];
    if (data.rating != null) {
      req.input("Rating", sql.Int, data.rating);
      set.push("Rating=@Rating");
    }
    if (data.comment != null) {
      req.input("Comment", sql.NVarChar, data.comment);
      set.push("Comment=@Comment");
    }
    if (data.isVisible != null) {
      req.input("IsVisible", sql.Bit, data.isVisible ? 1 : 0);
      set.push("IsVisible=@IsVisible");
    }

    if (!set.length) throw new Error("Không có trường nào để cập nhật");

    await req.query(`
      UPDATE ProductReviews
      SET ${set.join(", ")}, UpdatedAt=SYSUTCDATETIME()
      WHERE Id=@Id
    `);

    // Cập nhật điểm trung bình sản phẩm
    await pool.request()
      .input("Pid", sql.Int, id)
      .query(`
        UPDATE Products
        SET AverageRating = (
          SELECT CAST(AVG(CAST(Rating AS DECIMAL(3,2))) AS DECIMAL(3,2))
          FROM ProductReviews
          WHERE ProductId=(SELECT ProductId FROM ProductReviews WHERE Id=@Pid) AND IsVisible=1
        )
        WHERE Id=(SELECT ProductId FROM ProductReviews WHERE Id=@Pid)
      `);

    return { message: "✅ Cập nhật review thành công" };
  }

  // ✅ Ẩn/hiện nhanh review
  static async toggleVisibility(id, visible) {
    const pool = await getPool();
    await pool.request()
      .input("Id", sql.Int, id)
      .input("IsVisible", sql.Bit, visible ? 1 : 0)
      .query(`
        UPDATE ProductReviews
        SET IsVisible=@IsVisible, UpdatedAt=SYSUTCDATETIME()
        WHERE Id=@Id
      `);
    return { message: visible ? "✅ Review đã được hiển thị" : "🚫 Review đã bị ẩn" };
  }

  // ✅ Xoá review
  static async delete(id) {
    const pool = await getPool();
    const result = await pool.request().input("Id", sql.Int, id)
      .query("DELETE FROM ProductReviews WHERE Id=@Id");
    return { ok: result.rowsAffected[0] > 0 };
  }

  // ✅ Thống kê tổng quan review (dashboard)
  static async getStats() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        COUNT(*) AS TotalReviews,
        SUM(CASE WHEN IsVisible=1 THEN 1 ELSE 0 END) AS VisibleReviews,
        CAST(AVG(CAST(Rating AS DECIMAL(3,2))) AS DECIMAL(3,2)) AS AvgRating
      FROM ProductReviews
    `);
    return result.recordset[0];
  }

  // ✅ Thống kê top sản phẩm được đánh giá cao nhất
  static async topRatedProducts(limit = 5) {
    const pool = await getPool();
    const result = await pool.request()
      .input("TopN", sql.Int, limit)
      .query(`
        SELECT TOP (@TopN)
          p.Id, p.Name,
          COUNT(r.Id) AS ReviewCount,
          CAST(AVG(CAST(r.Rating AS DECIMAL(3,2))) AS DECIMAL(3,2)) AS AvgRating
        FROM Products p
        JOIN ProductReviews r ON p.Id=r.ProductId
        WHERE r.IsVisible=1
        GROUP BY p.Id, p.Name
        ORDER BY AvgRating DESC, ReviewCount DESC
      `);
    return result.recordset;
  }
}

module.exports = AdminReviewService;
