// models/ProductReview.js
const { sql, getPool } = require("../config/db");


/**
 * Model tiện ích thao tác trực tiếp với bảng ProductReviews.
 * Mọi query phức tạp sẽ được gọi từ Service.
 */
class ProductReviewModel {
  static async createTableIfNotExists() {
    const pool = await getPool();
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='ProductReviews' AND schema_id=SCHEMA_ID('dbo'))
      BEGIN
        CREATE TABLE dbo.ProductReviews (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          ProductId INT NOT NULL,
          UserId INT NOT NULL,
          Rating INT NOT NULL CHECK (Rating BETWEEN 1 AND 5),
          Comment NVARCHAR(1000) NULL,
          IsVisible BIT NOT NULL DEFAULT 1,
          CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
          UpdatedAt DATETIME2(0) NULL,
          CONSTRAINT FK_Reviews_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products(Id),
          CONSTRAINT FK_Reviews_User FOREIGN KEY (UserId) REFERENCES dbo.Users(Id),
          CONSTRAINT UQ_User_Product UNIQUE (ProductId, UserId)
        );
      END
    `);
  }
}

module.exports = ProductReviewModel;
