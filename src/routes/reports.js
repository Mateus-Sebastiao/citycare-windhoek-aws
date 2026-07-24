const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { createOrMergeReport } = require("../reportService");

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: process.env.UPLOAD_DIR || "./uploads",
    filename: (req, file, cb) => cb(null, `${uuid()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
});

// POST /api/v1/reports — citizen submits a municipal/utility issue
router.post("/reports", upload.single("photo"), async (req, res) => {
  const { category, title, description, latitude, longitude, addressText, reporterName, reporterPhone } = req.body;

  if (!category || !title || !description) {
    return res.status(400).json({ error: "category, title, description are required" });
  }

  const lat = latitude != null && latitude !== "" ? parseFloat(latitude) : null;
  const lng = longitude != null && longitude !== "" ? parseFloat(longitude) : null;

  const report = await createOrMergeReport(db, {
    category,
    title,
    description,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    addressText: addressText || null,
    imagePath: req.file ? `/uploads/${req.file.filename}` : null,
    reporterName: reporterName || null,
    reporterPhone: reporterPhone || null,
  });

  res.status(report.merged ? 200 : 201).json(report);
});

// GET /api/v1/reports/public — lightweight feed for the public transparency map
router.get("/reports/public", (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, category, title, latitude, longitude, severity_final AS severity, status, duplicate_count, created_at
       FROM reports WHERE latitude IS NOT NULL ORDER BY created_at DESC`
    )
    .all();
  res.json(rows);
});

// GET /api/v1/reports/:id
router.get("/reports/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

module.exports = router;
