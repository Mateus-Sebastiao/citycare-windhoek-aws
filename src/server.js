require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");

const reportsRouter = require("./routes/reports");
const lawsRouter = require("./routes/laws");
const ministriesRouter = require("./routes/ministries");
const adminRouter = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 4000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOAD_DIR));

app.use("/api/v1", reportsRouter);
app.use("/api/v1", lawsRouter);
app.use("/api/v1", ministriesRouter);
app.use("/api/v1", adminRouter);

// Public static pages: /admin (triage dashboard) and /map (transparency map)
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`OneVoice Na backend listening on :${PORT}`);
  console.log(`  Admin dashboard: http://localhost:${PORT}/admin`);
  console.log(`  Public map:      http://localhost:${PORT}/map`);
});
