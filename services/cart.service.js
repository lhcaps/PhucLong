// ======================================================
// 🛒 Cart Service — Phúc Long CNPMNC
// ------------------------------------------------------
// Tính năng: lấy giỏ, thêm (insert/update), cập nhật, xóa
// ======================================================

const { sql, getPool } = require("../config/db");

class CartService {
  static async getCart(userId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .query(`
        SELECT c.Id, c.ProductId, p.Name, p.Price, c.Quantity, c.Size, c.Sugar, c.Ice, c.Topping,
               (p.Price * c.Quantity) AS Subtotal
        FROM CartItems c
        JOIN Products p ON c.ProductId = p.Id
        WHERE c.UserId = @UserId
        ORDER BY c.CreatedAt DESC, c.Id DESC
      `);

    const items = result.recordset;
    const total = items.reduce((sum, i) => sum + Number(i.Subtotal), 0);
    return { items, total };
  }

  static async addItem(userId, { productId, quantity, size, sugar, ice, topping }) {
    if (!productId || !quantity) throw new Error("Thiếu productId hoặc quantity");
    const pool = await getPool();

    const check = await pool
      .request()
      .input("Id", sql.Int, productId)
      .query("SELECT Id FROM Products WHERE Id=@Id");
    if (!check.recordset.length) throw new Error(`❌ Sản phẩm Id=${productId} không tồn tại`);

    const normalize = (v) => (v ? String(v).replace("%", "").trim() : null);
    const normSugar = normalize(sugar);
    const normIce = normalize(ice);
    const toppingText = Array.isArray(topping) ? topping.join(", ") : topping || null;

    const exists = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("ProductId", sql.Int, productId)
      .input("Size", sql.NVarChar, size || null)
      .input("Sugar", sql.NVarChar, normSugar)
      .input("Ice", sql.NVarChar, normIce)
      .input("Topping", sql.NVarChar, toppingText)
      .query(`
        SELECT Id, Quantity FROM CartItems
        WHERE UserId=@UserId AND ProductId=@ProductId
          AND ISNULL(Size,'')=ISNULL(@Size,'')
          AND ISNULL(Sugar,'')=ISNULL(@Sugar,'')
          AND ISNULL(Ice,'')=ISNULL(@Ice,'')
          AND ISNULL(Topping,'')=ISNULL(@Topping,'')
      `);

    if (exists.recordset.length) {
      const newQty = exists.recordset[0].Quantity + quantity;
      await pool
        .request()
        .input("Id", sql.Int, exists.recordset[0].Id)
        .input("Quantity", sql.Int, newQty)
        .query("UPDATE CartItems SET Quantity=@Quantity WHERE Id=@Id");
      return { ok: true, message: "Đã tăng số lượng sản phẩm trong giỏ" };
    }

    const insert = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("ProductId", sql.Int, productId)
      .input("Quantity", sql.Int, quantity)
      .input("Size", sql.NVarChar, size || null)
      .input("Sugar", sql.NVarChar, normSugar)
      .input("Ice", sql.NVarChar, normIce)
      .input("Topping", sql.NVarChar, toppingText)
      .query(`
        INSERT INTO CartItems (UserId, ProductId, Quantity, Size, Sugar, Ice, Topping)
        OUTPUT INSERTED.Id
        VALUES (@UserId, @ProductId, @Quantity, @Size, @Sugar, @Ice, @Topping)
      `);

    return { ok: true, message: "Đã thêm vào giỏ hàng", id: insert.recordset[0]?.Id };
  }

  static async updateItem(userId, itemId, quantity) {
    if (quantity <= 0) throw new Error("Số lượng phải lớn hơn 0");
    const pool = await getPool();

    const result = await pool
      .request()
      .input("Id", sql.Int, itemId)
      .input("UserId", sql.Int, userId)
      .input("Quantity", sql.Int, quantity)
      .query("UPDATE CartItems SET Quantity=@Quantity WHERE Id=@Id AND UserId=@UserId");

    if ((result.rowsAffected?.[0] || 0) === 0)
      throw new Error("Không tìm thấy sản phẩm trong giỏ");
    return { ok: true, message: "Cập nhật thành công" };
  }

  static async removeItem(userId, itemId) {
    const pool = await getPool();
    const del = await pool
      .request()
      .input("Id", sql.Int, itemId)
      .input("UserId", sql.Int, userId)
      .query("DELETE FROM CartItems WHERE Id=@Id AND UserId=@UserId");

    if ((del.rowsAffected?.[0] || 0) === 0)
      throw new Error("Không tìm thấy sản phẩm để xóa");
    return { ok: true, message: "Đã xóa sản phẩm khỏi giỏ" };
  }
}

module.exports = CartService;
