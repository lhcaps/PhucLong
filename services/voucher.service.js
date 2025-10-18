// services/voucher.service.js
const { sql, getPool } = require("../config/db");


class VoucherService {
  // ✅ Kiểm tra voucher có hợp lệ cho đơn hàng
  static async preview(code, orderId) {
    const pool = await getPool();

    // Lấy thông tin voucher + order
    const result = await pool
      .request()
      .input("Code", sql.NVarChar, code)
      .query(`
        SELECT * FROM Vouchers WHERE Code=@Code AND IsActive=1
          AND (StartAt IS NULL OR StartAt <= SYSUTCDATETIME())
          AND (EndAt IS NULL OR EndAt >= SYSUTCDATETIME())
      `);
    if (!result.recordset.length)
      return { ok: false, error: { code: "VOUCHER_INVALID", message: "Voucher không tồn tại hoặc hết hạn" } };

    const voucher = result.recordset[0];

    const orderRes = await pool
      .request()
      .input("Id", sql.Int, orderId)
      .query("SELECT TOP 1 Id, Total, UserId, PaymentStatus FROM Orders WHERE Id=@Id");
    if (!orderRes.recordset.length)
      return { ok: false, error: { code: "ORDER_NOT_FOUND" } };

    const order = orderRes.recordset[0];
    if (order.PaymentStatus?.toLowerCase() === "paid")
      return { ok: false, error: { code: "ORDER_ALREADY_PAID" } };

    // Kiểm tra điều kiện min order
    if (voucher.MinOrder && order.Total < voucher.MinOrder)
      return { ok: false, error: { code: "MIN_ORDER_NOT_MET" } };

    // Tính toán giảm giá
    let discount = 0;
    if (voucher.Type === "FIXED") discount = voucher.Value;
    else if (voucher.Type === "PERCENT") {
      discount = (order.Total * voucher.Value) / 100;
      if (voucher.MaxDiscount && discount > voucher.MaxDiscount)
        discount = voucher.MaxDiscount;
    }
    if (discount > order.Total) discount = order.Total;

    return {
      ok: true,
      data: {
        voucher: {
          code: voucher.Code,
          type: voucher.Type,
          value: voucher.Value,
          discount,
        },
        orderTotal: order.Total,
        finalTotal: order.Total - discount,
      },
    };
  }

  // ✅ Xác nhận sử dụng voucher
  static async confirm(code, orderId, userId = null) {
    const pool = await getPool();
    const tx = new sql.Transaction(await poolPromise);
    await tx.begin();

    try {
      const request = new sql.Request(tx);

      // Lấy voucher
      const voucherRs = await request
        .input("Code", sql.NVarChar, code)
        .query(`
          SELECT * FROM Vouchers WHERE Code=@Code AND IsActive=1
            AND (StartAt IS NULL OR StartAt <= SYSUTCDATETIME())
            AND (EndAt IS NULL OR EndAt >= SYSUTCDATETIME())
        `);
      if (!voucherRs.recordset.length)
        throw new Error("Voucher không hợp lệ hoặc đã hết hạn");

      const voucher = voucherRs.recordset[0];

      // Lấy đơn hàng
      const orderRs = await request
        .input("OrderId", sql.Int, orderId)
        .query("SELECT Id, Total, PaymentStatus FROM Orders WHERE Id=@OrderId");
      if (!orderRs.recordset.length)
        throw new Error("Đơn hàng không tồn tại");

      const order = orderRs.recordset[0];
      if ((order.PaymentStatus || "").toLowerCase() === "paid")
        throw new Error("Đơn hàng đã thanh toán");

      // Tính discount
      let discount = 0;
      if (voucher.Type === "FIXED") discount = voucher.Value;
      else if (voucher.Type === "PERCENT") {
        discount = (order.Total * voucher.Value) / 100;
        if (voucher.MaxDiscount && discount > voucher.MaxDiscount)
          discount = voucher.MaxDiscount;
      }
      if (discount > order.Total) discount = order.Total;

      // Cập nhật order
      await request
        .input("Discount", sql.Decimal(18, 2), discount)
        .input("OrderId", sql.Int, order.Id)
        .query(`
          UPDATE Orders
          SET PaymentStatus='paid', Status='confirmed', PaymentMethod='VOUCHER', Total = Total - @Discount
          WHERE Id=@OrderId
        `);

      // Ghi log VoucherRedemptions (idempotent)
      await request
        .input("VoucherId", sql.Int, voucher.Id)
        .input("OrderId", sql.Int, order.Id)
        .input("UserId", sql.Int, userId)
        .input("Amount", sql.Int, discount)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM VoucherRedemptions WHERE VoucherId=@VoucherId AND OrderId=@OrderId)
          BEGIN
            INSERT INTO VoucherRedemptions(VoucherId, OrderId, UserId, Amount)
            VALUES (@VoucherId, @OrderId, @UserId, @Amount)
          END
        `);

      // Ghi log giao dịch
      await request
        .input("Provider", sql.NVarChar(32), "VOUCHER")
        .input("TxnRef", sql.NVarChar(64), voucher.Code)
        .input("Amount", sql.Int, discount)
        .input("Currency", sql.NVarChar(8), "VND")
        .query(`
          INSERT INTO Transactions(OrderId, Provider, TxnRef, Amount, Currency, Status, CreatedAt)
          VALUES(@OrderId, @Provider, @TxnRef, @Amount, @Currency, 'success', SYSUTCDATETIME())
        `);

      // Cập nhật UsedCount
      await request
        .input("Id", sql.Int, voucher.Id)
        .query("UPDATE Vouchers SET UsedCount = UsedCount + 1 WHERE Id=@Id");

      await tx.commit();

      return {
        ok: true,
        data: {
          orderId: order.Id,
          voucher: voucher.Code,
          discount,
          message: "Voucher áp dụng thành công",
        },
      };
    } catch (err) {
      await tx.rollback();
      return { ok: false, error: { code: "VOUCHER_FAIL", message: err.message } };
    }
  }
}

module.exports = VoucherService;
