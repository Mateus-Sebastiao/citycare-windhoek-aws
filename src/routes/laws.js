const express = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");

const router = express.Router();

// GET /api/v1/laws — active published legislation, for local caching in the app
router.get("/laws", (req, res) => {
  res.json(db.prepare("SELECT * FROM laws ORDER BY published_at DESC").all());
});

router.get("/laws/:id", (req, res) => {
  const law = db.prepare("SELECT * FROM laws WHERE id = ?").get(req.params.id);
  if (!law) return res.status(404).json({ error: "not found" });
  res.json(law);
});

// POST /api/v1/laws/:id/comments — citizen rating + written feedback on a law
router.post("/laws/:id/comments", (req, res) => {
  const { rating, commentText, commenterName } = req.body;
  const law = db.prepare("SELECT id FROM laws WHERE id = ?").get(req.params.id);
  if (!law) return res.status(404).json({ error: "law not found" });
  if (!commentText) return res.status(400).json({ error: "commentText is required" });

  const id = uuid();
  db.prepare(
    `INSERT INTO law_comments (id, law_id, rating, comment_text, commenter_name, created_at)
     VALUES (?,?,?,?,?,?)`
  ).run(id, req.params.id, rating ? parseInt(rating, 10) : null, commentText, commenterName || null, new Date().toISOString());

  res.status(201).json(db.prepare("SELECT * FROM law_comments WHERE id = ?").get(id));
});

module.exports = router;
