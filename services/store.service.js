// services/store.service.js
const { sql, getPool } = require("../config/db");
class StoreService {
  static async nearest({ lat, lng, limit = 5, radius = null, openOnly = 1 }) {
    if (lat == null || lng == null) throw new Error("LAT_LNG_REQUIRED");
    limit = Math.min(Math.max(Number(limit) || 5, 1), 20);

    const pool = await getPool();
    const req = pool.request()
      .input("Lat", sql.Decimal(10, 6), lat)
      .input("Lng", sql.Decimal(10, 6), lng)
      .input("Limit", sql.Int, limit)
      .input("OpenOnly", sql.Bit, openOnly ? 1 : 0);

    // Nếu bạn có proc dbo.Stores_Nearest thì dùng (nhanh hơn)
    // const rs = await req.execute("Stores_Nearest");

    // Nếu muốn chạy thuần SQL:
    const rs = await req.query(`
      WITH StoresWithDistance AS (
        SELECT TOP (@Limit)
          s.Id, s.Code, s.Name, s.Address, s.Lat, s.Lng, s.IsActive,
          -- Haversine approx (km)
          6371 * 2 * ASIN(
            SQRT(
              POWER(SIN(RADIANS((@Lat - s.Lat)/2)),2) +
              COS(RADIANS(@Lat)) * COS(RADIANS(s.Lat)) *
              POWER(SIN(RADIANS((@Lng - s.Lng)/2)),2)
            )
          ) AS DistanceKm
        FROM Stores s
        WHERE (@OpenOnly = 0 OR s.IsActive = 1)
      )
      SELECT * FROM StoresWithDistance
      WHERE (@OpenOnly = 0 OR IsActive = 1)
      ${radius ? "AND DistanceKm <= " + Number(radius) : ""}
      ORDER BY DistanceKm ASC;
    `);

    return rs.recordset;
  }

  static async bulkUpsert(jsonArray) {
    const pool = await getPool();
    const data = Array.isArray(jsonArray) ? jsonArray : [];
    await pool.request()
      .input("json", sql.NVarChar(sql.MAX), JSON.stringify(data))
      .query(`
        IF OBJECT_ID('dbo.usp_Stores_BulkUpsertFromJson') IS NOT NULL
        BEGIN
          EXEC dbo.usp_Stores_BulkUpsertFromJson @json=@json;
        END
        ELSE
        BEGIN
          -- Fallback upsert theo Code (đơn giản)
          DECLARE @doc TABLE (Code NVARCHAR(50), Name NVARCHAR(100), Address NVARCHAR(255), Lat DECIMAL(10,6), Lng DECIMAL(10,6), IsActive BIT);
          INSERT INTO @doc (Code, Name, Address, Lat, Lng, IsActive)
          SELECT j.[Code], j.[Name], j.[Address], j.[Lat], j.[Lng], ISNULL(j.[IsActive],1)
          FROM OPENJSON(@json)
          WITH (
            [Code] NVARCHAR(50) '$.code',
            [Name] NVARCHAR(100) '$.name',
            [Address] NVARCHAR(255) '$.address',
            [Lat] DECIMAL(10,6) '$.lat',
            [Lng] DECIMAL(10,6) '$.lng',
            [IsActive] BIT '$.isActive'
          ) j;

          MERGE Stores AS tgt
          USING (SELECT * FROM @doc) src
            ON (tgt.Code = src.Code)
          WHEN MATCHED THEN
            UPDATE SET Name=src.Name, Address=src.Address, Lat=src.Lat, Lng=src.Lng, IsActive=src.IsActive
          WHEN NOT MATCHED THEN
            INSERT (Code, Name, Address, Lat, Lng, IsActive, CreatedAt)
            VALUES (src.Code, src.Name, src.Address, src.Lat, src.Lng, src.IsActive, SYSUTCDATETIME());
        END
      `);
    return { ok: true, message: "Bulk upsert stores success" };
  }
}

module.exports = StoreService;
