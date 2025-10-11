const { ZodError } = require("zod");

function validate(schema, pick = "body") {
  return (req, res, next) => {
    try {
      req[pick] = schema.parse(req[pick]);
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        return res.status(400).json({ error: e.errors.map(x => x.message).join(", ") });
      }
      next(e);
    }
  };
}

module.exports = { validate };
