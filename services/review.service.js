// services/review.service.js
const { sql, getPool } = require("../config/db");
class ReviewService {
  static async upsert(userId, productId, rating, comment) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const req = new sql.Request(tx);

      // Kiểm tra sản phẩm tồn tại
      const exists = await req
        .input("ProductId", sql.Int, productId)
        .query("SELECT Id FROM Products WHERE Id=@ProductId");
      if (!exists.recordset.length) {
        await tx.rollback();
        return { ok: false, error: "PRODUCT_NOT_FOUND" };
      }

      // Upsert (nếu đã có thì update)
      const found = await req
        .input("UserId", sql.Int, userId)
        .input("ProductId", sql.Int, productId)
        .query("SELECT Id FROM ProductReviews WHERE UserId=@UserId AND ProductId=@ProductId");

      if (found.recordset.length) {
        await req
          .input("Rating", sql.Int, rating)
          .input("Comment", sql.NVarChar, comment)
          .query(`
            UPDATE ProductReviews
            SET Rating=@Rating, Comment=@Comment, UpdatedAt=SYSUTCDATETIME()
            WHERE UserId=@UserId AND ProductId=@ProductId
          `);
      } else {
        await req
          .input("Rating", sql.Int, rating)
          .input("Comment", sql.NVarChar, comment)
          .query(`
            INSERT INTO ProductReviews (ProductId, UserId, Rating, Comment)
            VALUES (@ProductId, @UserId, @Rating, @Comment)
          `);
      }

      // Cập nhật điểm trung bình
      await req
        .input("Pid", sql.Int, productId)
        .query(`
          UPDATE Products
          SET AverageRating = (
            SELECT CAST(AVG(CAST(Rating AS DECIMAL(3,2))) AS DECIMAL(3,2))
            FROM ProductReviews
            WHERE ProductId=@Pid AND IsVisible=1
          )
          WHERE Id=@Pid
        `);

      await tx.commit();
      return { ok: true, message: "Review saved successfully" };
    } catch (err) {
      try { await tx.rollback(); } catch {}
      return { ok: false, error: err.message };
    }
  }

  static async listByProduct(productId) {
    const pool = await getPool();
    const result = await pool.request()
      .input("ProductId", sql.Int, productId)
      .query(`
        SELECT pr.*, u.Name AS UserName
        FROM ProductReviews pr
        JOIN Users u ON pr.UserId=u.Id
        WHERE pr.ProductId=@ProductId AND pr.IsVisible=1
        ORDER BY pr.CreatedAt DESC
      `);
    return result.recordset;
  }

  static async listAll() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT pr.*, u.Name AS UserName, p.Name AS ProductName
      FROM ProductReviews pr
      JOIN Users u ON pr.UserId=u.Id
      JOIN Products p ON pr.ProductId=p.Id
      ORDER BY pr.CreatedAt DESC
    `);
    return result.recordset;
  }

  static async updateByAdmin(id, fields) {
    const pool = await getPool();
    const req = pool.request().input("Id", sql.Int, id);
    const set = [];
    if (fields.rating != null) {
      req.input("Rating", sql.Int, fields.rating);
      set.push("Rating=@Rating");
    }
    if (fields.comment != null) {
      req.input("Comment", sql.NVarChar, fields.comment);
      set.push("Comment=@Comment");
    }
    if (fields.isVisible != null) {
      req.input("IsVisible", sql.Bit, fields.isVisible);
      set.push("IsVisible=@IsVisible");
    }
    if (!set.length) return { ok: false, error: "NO_FIELDS" };
    await req.query(`UPDATE ProductReviews SET ${set.join(", ")} WHERE Id=@Id`);
    return { ok: true };
  }

  static async delete(id, userId = null, isAdmin = false) {
    const pool = await getPool();
    const req = pool.request().input("Id", sql.Int, id);
    let query = "DELETE FROM ProductReviews WHERE Id=@Id";
    if (!isAdmin) {
      req.input("UserId", sql.Int, userId);
      query += " AND UserId=@UserId";
    }
    const result = await req.query(query);
    return { ok: result.rowsAffected[0] > 0 };
  }
}

module.exports = ReviewService;
