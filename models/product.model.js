class Product {
  constructor({ Id, Name, Description, Price, ImageUrl, Stock, CategoryId }) {
    this.Id = Id;
    this.Name = Name;
    this.Description = Description;
    this.Price = Price;
    this.ImageUrl = ImageUrl;
    this.Stock = Stock;
    this.CategoryId = CategoryId;
  }
}

module.exports = Product;
