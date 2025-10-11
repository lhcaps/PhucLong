const express = require("express");
const { authenticateJWT, authorizeAdmin } = require("../../middleware/auth.middleware");
const AdminUserController = require("../../controllers/admin/admin.user.controller");

const router = express.Router();
router.use(authenticateJWT, authorizeAdmin);

router.get("/", AdminUserController.getAll);
router.put("/:id/role", AdminUserController.updateRole);
router.delete("/:id", AdminUserController.delete);

module.exports = router;
