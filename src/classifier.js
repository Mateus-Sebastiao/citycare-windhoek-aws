const SEVERITIES = ["LIGHT", "MEDIUM", "CRITICAL"];

// Keyword → severity map, checked against category + title + description (lowercased).
// This is the fallback used whenever Gemini is unavailable, slow, or rate-limited.
const CRITICAL_KEYWORDS = [
  "no water", "burst pipe", "burst water", "gas leak", "exposed wire", "live wire",
  "electrocut", "sewage", "raw sewage", "flooding", "collapsed", "fire hazard",
  "no electricity", "power outage", "explosion", "unsafe structure",
];
const MEDIUM_KEYWORDS = [
  "pothole", "traffic light", "robot not working", "leak", "water pressure",
  "streetlight", "street light", "blocked drain", "road damage", "sinkhole",
];
const LIGHT_KEYWORDS = [
  "graffiti", "litter", "uncollected garbage", "garbage", "cosmetic", "faded", "sign",
];

const CATEGORY_DEFAULT_SEVERITY = {
  "Water Leak": "CRITICAL",
  "Power Outage": "CRITICAL",
  "Sewage": "CRITICAL",
  "Pothole": "MEDIUM",
  "Traffic Light": "MEDIUM",
  "Streetlight": "MEDIUM",
  "Garbage": "LIGHT",
  "Other": "MEDIUM",
};

function ruleBasedSeverity({ category, title, description }) {
  const text = `${title} ${description}`.toLowerCase();

  if (CRITICAL_KEYWORDS.some((k) => text.includes(k))) return "CRITICAL";
  if (LIGHT_KEYWORDS.some((k) => text.includes(k))) return "LIGHT";
  if (MEDIUM_KEYWORDS.some((k) => text.includes(k))) return "MEDIUM";

  return CATEGORY_DEFAULT_SEVERITY[category] || "MEDIUM";
}

function bumpForDuplicates(severity, duplicateCount) {
  if (duplicateCount >= 10 && severity !== "CRITICAL") return "CRITICAL";
  if (duplicateCount >= 4 && severity === "LIGHT") return "MEDIUM";
  return severity;
}

async function geminiSeverity({ category, title, description }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `You triage municipal issue reports for a Namibian city council. ` +
    `Classify the severity of this report as exactly one of CRITICAL, MEDIUM, or LIGHT, ` +
    `and write a one-sentence summary for an admin dashboard.\n\n` +
    `Category: ${category}\nTitle: ${title}\nDescription: ${description}\n\n` +
    `CRITICAL = immediate danger to life/health/property (e.g. exposed live wires, gas leaks, raw sewage, no water supply to an area). ` +
    `MEDIUM = disrupts daily life but not immediately dangerous (e.g. potholes, broken traffic lights, streetlights out). ` +
    `LIGHT = cosmetic or low-urgency (e.g. litter, graffiti, faded signage).\n\n` +
    `Respond with ONLY compact JSON, no markdown: {"severity": "CRITICAL|MEDIUM|LIGHT", "summary": "..."}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!SEVERITIES.includes(parsed.severity)) return null;

    return { severity: parsed.severity, summary: parsed.summary || null };
  } catch {
    return null; // network error, timeout, bad JSON — caller falls back to rules
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Classifies a report. Always returns a rule-based severity (fast, free, offline-safe).
 * Layers a Gemini call on top when GEMINI_API_KEY is set; on any failure it silently
 * keeps the rule-based result so a flaky demo-day connection never breaks report submission.
 */
async function classifyReport({ category, title, description }, duplicateCount = 1) {
  const ruleSeverity = ruleBasedSeverity({ category, title, description });
  const ai = await geminiSeverity({ category, title, description });

  // The duplicate-count escalation must apply to whichever severity we ultimately use,
  // not only the rule-based one — otherwise a widely-reported issue that Gemini rated
  // MEDIUM would never escalate to CRITICAL.
  const baseFinal = ai?.severity || ruleSeverity;

  return {
    severityRule: bumpForDuplicates(ruleSeverity, duplicateCount),
    severityAi: ai?.severity || null,
    severityFinal: bumpForDuplicates(baseFinal, duplicateCount),
    aiSummary: ai?.summary || null,
  };
}

module.exports = { classifyReport, ruleBasedSeverity, SEVERITIES };
