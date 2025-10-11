const fs = require("fs");
const path = require("path");
const { createLogger, format, transports } = require("winston");

const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(({ level, message, timestamp }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: path.join(logDir, "error.log"), level: "error" }),
    new transports.File({ filename: path.join(logDir, "combined.log") })
  ],
});

module.exports = logger;
