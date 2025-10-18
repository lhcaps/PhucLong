// routes/store.routes.js
const express = require("express");
const { authenticateJWT, authorizeAdmin } = require("../middleware/auth.middleware");
const StoreController = require("../controllers/store.controller");

const router = express.Router();

router.get("/near", StoreController.near);
router.post("/bulk-upsert", authenticateJWT, authorizeAdmin, StoreController.bulkUpsert);

module.exports = router;
