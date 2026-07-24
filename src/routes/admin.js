const express = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");

const router = express.Router();

// Simple shared-secret auth for the MVP — swap for real auth before any non-demo use.
function requireAdmin(req, res, next) {
  const user = req.headers["x-admin-user"];
  const pass = req.headers["x-admin-password"];
  if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASSWORD) return next();
  res.status(401).json({ error: "unauthorized" });
}

router.use(requireAdmin);

const VALID_STATUSES = ["RECEIVED", "IN_PROGRESS", "RESOLVED", "REJECTED"];
const SEVERITY_RANK = { CRITICAL: 0, MEDIUM: 1, LIGHT: 2 };

// GET /api/v1/admin/reports — triage queue, sorted by severity then recency
router.get("/admin/reports", (req, res) => {
  const { status, category } = req.query;
  let rows = db.prepare("SELECT * FROM reports ORDER BY created_at DESC").all();

  if (status) rows = rows.filter((r) => r.status === status);
  if (category) rows = rows.filter((r) => r.category === category);

  rows.sort((a, b) => {
    const rankDiff = (SEVERITY_RANK[a.severity_final] ?? 9) - (SEVERITY_RANK[b.severity_final] ?? 9);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  res.json(rows);
});

// PATCH /api/v1/admin/reports/:id — update resolution status
router.patch("/admin/reports/:id", (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` });
  }
  const existing = db.prepare("SELECT id FROM reports WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });

  db.prepare("UPDATE reports SET status = ?, updated_at = ? WHERE id = ?").run(
    status, new Date().toISOString(), req.params.id
  );
  res.json(db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id));
});

// POST /api/v1/admin/laws — publish a new law/policy for public commentary
router.post("/admin/laws", (req, res) => {
  const { title, summary, fullText } = req.body;
  if (!title || !summary) return res.status(400).json({ error: "title and summary are required" });

  const id = uuid();
  db.prepare(
    `INSERT INTO laws (id, title, summary, full_text, published_at) VALUES (?,?,?,?,?)`
  ).run(id, title, summary, fullText || null, new Date().toISOString());

  res.status(201).json(db.prepare("SELECT * FROM laws WHERE id = ?").get(id));
});

// GET /api/v1/admin/laws/:id/comments — citizen feedback + ratings on a law
router.get("/admin/laws/:id/comments", (req, res) => {
  res.json(
    db.prepare("SELECT * FROM law_comments WHERE law_id = ? ORDER BY created_at DESC").all(req.params.id)
  );
});

// GET /api/v1/admin/suggestions — direct citizen proposals, filterable by ministry
router.get("/admin/suggestions", (req, res) => {
  const { ministryId } = req.query;
  let rows = db.prepare("SELECT * FROM ministry_suggestions ORDER BY created_at DESC").all();
  if (ministryId) rows = rows.filter((r) => r.ministry_id === ministryId);
  res.json(rows);
});

module.exports = router;
