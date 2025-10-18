// models/cart.model.js
class CartItem {
  constructor({ Id, UserId, ProductId, Quantity, Size, Sugar, Ice, Topping }) {
    this.Id = Id;
    this.UserId = UserId;
    this.ProductId = ProductId;
    this.Quantity = Quantity;
    this.Size = Size;
    this.Sugar = Sugar;
    this.Ice = Ice;
    this.Topping = Topping;
  }
}

module.exports = CartItem;
