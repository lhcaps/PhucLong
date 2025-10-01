const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret"; // fallback để tránh lỗi khi chưa có env

// ✅ Kiểm tra JWT token
function authenticateJWT(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Invalid token format" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { userId, role, email, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token invalid or expired" });
  }
}

// ✅ Kiểm tra quyền admin
function authorizeAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Require admin role" });
  }
  next();
}

module.exports = { authenticateJWT, authorizeAdmin };
