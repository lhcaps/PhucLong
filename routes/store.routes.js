// routes/store.routes.js
const express = require("express");
const { sql, poolPromise } = require("../config/db");
const { authenticateJWT, authorizeAdmin } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * GET /api/stores/near?lat=..&lng=..&limit=5&radius=5&openOnly=1
 * - lat,lng: bắt buộc
 * - limit: số bản ghi trả về (mặc định 5, tối đa 20)
 * - radius: bán kính (km), nếu không truyền thì không lọc theo bán kính
 * - openOnly: 1/0 (mặc định 1), 1 = chỉ lấy cửa hàng đang mở
 */
router.get("/near", async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const radiusKm = req.query.radius ? Number(req.query.radius) : null;
    const openOnly = !(
      String(req.query.openOnly).toLowerCase() === "0" ||
      String(req.query.openOnly).toLowerCase() === "false"
    );

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "Thiếu hoặc sai lat/lng" } });
    }

    const pool = await poolPromise;
    const request = pool
      .request()
      .input("Lat", sql.Float, lat)
      .input("Lng", sql.Float, lng)
      .input("TopN", sql.Int, limit)
      .input("OpenOnly", sql.Bit, openOnly ? 1 : 0)
      .input("RadiusMeters", sql.Float, radiusKm ? radiusKm * 1000 : null);

    const { recordset } = await request.query(`
      DECLARE @P geography = geography::Point(@Lat, @Lng, 4326);

      ;WITH S AS (
        SELECT
          s.Id, s.Code, s.Name, s.Address, s.Phone, s.OpenTimeText, s.IsOpen, s.Lat, s.Lng,
          DistanceMeters =
            CASE
              WHEN s.Lat IS NOT NULL AND s.Lng IS NOT NULL
              THEN geography::Point(s.Lat, s.Lng, 4326).STDistance(@P)
              ELSE NULL
            END
        FROM dbo.Stores s
        WHERE (@OpenOnly = 0 OR s.IsOpen = 1)
          AND (
            @RadiusMeters IS NULL
            OR (
              s.Lat IS NOT NULL AND s.Lng IS NOT NULL
              AND geography::Point(s.Lat, s.Lng, 4326).STDistance(@P) <= @RadiusMeters
            )
          )
      )
      SELECT TOP (@TopN)
        Id, Code, Name, Address, Phone, OpenTimeText, IsOpen, Lat, Lng,
        DistanceMeters,
        CAST(DistanceMeters / 1000.0 AS DECIMAL(9,3)) AS DistanceKm
      FROM S
      ORDER BY
        CASE WHEN DistanceMeters IS NOT NULL THEN DistanceMeters ELSE 1e15 END ASC,
        Id ASC;
    `);

    return res.json({ success: true, data: recordset });
  } catch (err) {
    next(err);
  }
});

/** POST /api/stores/bulk-upsert (admin) – body: JSON array of stores */
router.post("/bulk-upsert", authenticateJWT, authorizeAdmin, async (req, res, next) => {
  try {
    const data = Array.isArray(req.body) ? req.body : [];
    const pool = await poolPromise;
    await pool
      .request()
      .input("json", sql.NVarChar(sql.MAX), JSON.stringify(data))
      .execute("dbo.usp_Stores_BulkUpsertFromJson");

    res.json({ success: true, message: "Upsert stores OK", count: data.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
