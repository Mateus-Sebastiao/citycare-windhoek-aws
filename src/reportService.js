const { v4: uuid } = require("uuid");
const { classifyReport } = require("./classifier");
const { clusterKey, findNearbyOpenReport } = require("./cluster");

/**
 * Create a report, or merge it into a nearby open report of the same category.
 * Shared by the POST /reports route and the seed script so both behave identically.
 * Returns the resulting report row, with `merged: true` when it folded into an existing one.
 */
async function createOrMergeReport(db, fields) {
  const {
    category, title, description,
    latitude = null, longitude = null, addressText = null,
    imagePath = null, reporterName = null, reporterPhone = null,
    createdAt,
  } = fields;

  const now = createdAt || new Date().toISOString();

  const existing = findNearbyOpenReport(db, { category, latitude, longitude });
  if (existing) {
    const newCount = existing.duplicate_count + 1;
    const { severityRule, severityAi, severityFinal, aiSummary } = await classifyReport(
      { category: existing.category, title: existing.title, description: existing.description },
      newCount
    );
    db.prepare(
      `UPDATE reports SET duplicate_count = ?, severity_rule = ?, severity_ai = ?, severity_final = ?, ai_summary = ?, updated_at = ? WHERE id = ?`
    ).run(newCount, severityRule, severityAi, severityFinal, aiSummary, now, existing.id);

    return { ...db.prepare("SELECT * FROM reports WHERE id = ?").get(existing.id), merged: true };
  }

  const id = uuid();
  const { severityRule, severityAi, severityFinal, aiSummary } = await classifyReport(
    { category, title, description }
  );

  db.prepare(
    `INSERT INTO reports
      (id, category, title, description, latitude, longitude, address_text, image_path,
       reporter_name, reporter_phone, severity_rule, severity_ai, severity_final, ai_summary,
       status, cluster_key, duplicate_count, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id, category, title, description, latitude, longitude, addressText,
    imagePath, reporterName, reporterPhone,
    severityRule, severityAi, severityFinal, aiSummary,
    "RECEIVED", clusterKey(category, latitude, longitude), 1, now, now
  );

  return db.prepare("SELECT * FROM reports WHERE id = ?").get(id);
}

module.exports = { createOrMergeReport };
