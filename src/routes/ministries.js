const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuid } = require("uuid");
const db = require("../db");

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: process.env.UPLOAD_DIR || "./uploads",
    filename: (req, file, cb) => cb(null, `${uuid()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
});

// GET /api/v1/ministries
router.get("/ministries", (req, res) => {
  res.json(db.prepare("SELECT * FROM ministries WHERE is_active = 1 ORDER BY name").all());
});

// POST /api/v1/suggestions — direct citizen suggestion to a ministry, optional attachment
router.post("/suggestions", upload.single("attachment"), (req, res) => {
  const { ministryId, subject, content, reporterName, reporterPhone } = req.body;
  if (!ministryId || !subject || !content) {
    return res.status(400).json({ error: "ministryId, subject, content are required" });
  }
  const ministry = db.prepare("SELECT id FROM ministries WHERE id = ?").get(ministryId);
  if (!ministry) return res.status(404).json({ error: "ministry not found" });

  const id = uuid();
  db.prepare(
    `INSERT INTO ministry_suggestions
      (id, ministry_id, subject, content, attachment_path, reporter_name, reporter_phone, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    id, ministryId, subject, content,
    req.file ? `/uploads/${req.file.filename}` : null,
    reporterName || null, reporterPhone || null,
    "NEW", new Date().toISOString()
  );

  res.status(201).json(db.prepare("SELECT * FROM ministry_suggestions WHERE id = ?").get(id));
});

module.exports = router;
