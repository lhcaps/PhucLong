const { sql, poolPromise } = require('../config/db');

class CartService {
  // Lấy giỏ hàng
  static async getCart(userId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("UserId", sql.Int, userId)
      .query(`
        SELECT c.Id, c.ProductId, p.Name, p.Price, c.Quantity, c.Size, c.Sugar, c.Ice, c.Topping,
               (p.Price * c.Quantity) as Subtotal
        FROM CartItems c
        JOIN Products p ON c.ProductId = p.Id
        WHERE c.UserId = @UserId
      `);
    const items = result.recordset;
    const total = items.reduce((sum, i) => sum + Number(i.Subtotal), 0);
    return { items, total };
  }

  // ✅ Thêm sản phẩm vào giỏ (đã normalize Sugar/Ice)
  static async addItem(userId, productId, quantity, size, sugar, ice, topping) {
    const pool = await poolPromise;

    // Check sản phẩm tồn tại
    const product = await pool.request()
      .input("Id", sql.Int, productId)
      .query("SELECT Id FROM Products WHERE Id=@Id");
    if (!product.recordset.length) throw new Error("Sản phẩm không tồn tại");

    // ✅ Normalize và validate Sugar/Ice
    const ALLOWED = ["0", "30", "50", "70", "100"];
    let sugarNorm = sugar == null ? null : String(sugar).replace("%", "").trim();
    let iceNorm = ice == null ? null : String(ice).replace("%", "").trim();

    if (sugarNorm && !ALLOWED.includes(sugarNorm)) {
      throw new Error("Sugar không hợp lệ. Chỉ chấp nhận: 0, 30, 50, 70, 100");
    }
    if (iceNorm && !ALLOWED.includes(iceNorm)) {
      throw new Error("Ice không hợp lệ. Chỉ chấp nhận: 0, 30, 50, 70, 100");
    }

    // Nếu đã có cùng sản phẩm + option thì update số lượng
    const exists = await pool.request()
      .input("UserId", sql.Int, userId)
      .input("ProductId", sql.Int, productId)
      .input("Size", sql.NVarChar, size || null)
      .input("Sugar", sql.NVarChar, sugarNorm || null)
      .input("Ice", sql.NVarChar, iceNorm || null)
      .input("Topping", sql.NVarChar, topping || null)
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
      await pool.request()
        .input("Id", sql.Int, exists.recordset[0].Id)
        .input("Quantity", sql.Int, newQty)
        .query("UPDATE CartItems SET Quantity=@Quantity WHERE Id=@Id");
    } else {
      await pool.request()
        .input("UserId", sql.Int, userId)
        .input("ProductId", sql.Int, productId)
        .input("Quantity", sql.Int, quantity)
        .input("Size", sql.NVarChar, size || null)
        .input("Sugar", sql.NVarChar, sugarNorm || null)
        .input("Ice", sql.NVarChar, iceNorm || null)
        .input("Topping", sql.NVarChar, topping || null)
        .query(`
          INSERT INTO CartItems (UserId, ProductId, Quantity, Size, Sugar, Ice, Topping)
          VALUES (@UserId, @ProductId, @Quantity, @Size, @Sugar, @Ice, @Topping)
        `);
    }

    return { message: "✅ Đã thêm vào giỏ" };
  }

  // Cập nhật số lượng
  static async updateItem(userId, itemId, quantity) {
    if (quantity <= 0) throw new Error("Số lượng phải lớn hơn 0");
    const pool = await poolPromise;
    const result = await pool.request()
      .input("Id", sql.Int, itemId)
      .input("UserId", sql.Int, userId)
      .input("Quantity", sql.Int, quantity)
      .query("UPDATE CartItems SET Quantity=@Quantity WHERE Id=@Id AND UserId=@UserId");

    if (result.rowsAffected[0] === 0)
      throw new Error("Không tìm thấy sản phẩm trong giỏ");

    return { message: "✅ Đã cập nhật số lượng" };
  }

  // Xóa sản phẩm khỏi giỏ
  static async removeItem(userId, itemId) {
    const pool = await poolPromise;
    await pool.request()
      .input("Id", sql.Int, itemId)
      .input("UserId", sql.Int, userId)
      .query("DELETE FROM CartItems WHERE Id=@Id AND UserId=@UserId");
    return { message: "🗑️ Đã xóa sản phẩm khỏi giỏ" };
  }
}

module.exports = CartService;
