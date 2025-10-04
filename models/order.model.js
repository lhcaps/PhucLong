class Order {
  constructor({ Id, UserId, TotalAmount, Status, PaymentStatus, CreatedAt }) {
    this.Id = Id;
    this.UserId = UserId;
    this.TotalAmount = TotalAmount;
    this.Status = Status;
    this.PaymentStatus = PaymentStatus;
    this.CreatedAt = CreatedAt;
  }
}

class OrderItem {
  constructor({ Id, OrderId, ProductId, Size, Topping, Quantity, Price }) {
    this.Id = Id;
    this.OrderId = OrderId;
    this.ProductId = ProductId;
    this.Size = Size;
    this.Topping = Topping;
    this.Quantity = Quantity;
    this.Price = Price;
  }
}

module.exports = { Order, OrderItem };
