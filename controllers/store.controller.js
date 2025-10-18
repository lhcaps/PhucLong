// controllers/store.controller.js
const StoreService = require("../services/store.service");

class StoreController {
  static async near(req, res, next) {
    try {
      const { lat, lng, limit, radius, openOnly = 1 } = req.query;
      const data = await StoreService.nearest({
        lat: Number(lat), lng: Number(lng),
        limit: limit ? Number(limit) : 5,
        radius: radius ? Number(radius) : null,
        openOnly: Number(openOnly) ? 1 : 0
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async bulkUpsert(req, res, next) {
    try {
      const result = await StoreService.bulkUpsert(req.body);
      res.json(result);
    } catch (err) { next(err); }
  }
}

module.exports = StoreController;
