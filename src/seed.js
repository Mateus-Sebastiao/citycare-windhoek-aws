require("dotenv").config();
const { v4: uuid } = require("uuid");
const db = require("./db");
const { createOrMergeReport } = require("./reportService");

const MINISTRIES = [
  { name: "Ministry of Sport, Youth and National Service", code: "MSYNS", contact_email: "info@msyns.gov.na" },
  { name: "Ministry of Education, Arts and Culture", code: "MOEAC", contact_email: "info@moe.gov.na" },
  { name: "Ministry of Health and Social Services", code: "MOHSS", contact_email: "info@mhss.gov.na" },
  { name: "City of Windhoek Municipality", code: "COW", contact_email: "info@windhoekcc.org.na" },
];

const LAWS = [
  {
    title: "Land Reform Bill",
    summary:
      "A proposed framework to accelerate equitable land redistribution, clarify ancestral land claims, and establish transparent compensation procedures. Public input is invited on the fairness and timeline of the proposed measures.",
  },
  {
    title: "Education Budget",
    summary:
      "The annual allocation for public education, covering teacher salaries, school infrastructure, and learning materials. Citizens are encouraged to comment on funding priorities and regional distribution.",
  },
  {
    title: "Municipal Waste Management Bylaw Amendment",
    summary:
      "Proposed updates to Windhoek's waste collection schedule and penalties for illegal dumping, aimed at reducing uncollected garbage complaints in high-density suburbs.",
  },
];

// Rough Windhoek-area coordinates. The first several are the SAME burst pipe reported by
// different residents within ~50m — routed through the merge logic they collapse into one
// ticket with a duplicate counter, so the demo shows "N citizens reported this" out of the box.
const REPORTS = [
  { category: "Water Leak", title: "Burst pipe flooding street", description: "Burst water pipe on Independence Ave, water flooding the road and no supply to nearby houses.", lat: -22.5700, lng: 17.0836, address: "Independence Ave, Windhoek" },
  { category: "Water Leak", title: "Burst pipe still flooding", description: "Same burst pipe, water pressure dropping in Klein Windhoek.", lat: -22.5701, lng: 17.0837, address: "Independence Ave, Windhoek" },
  { category: "Water Leak", title: "Water everywhere on Independence", description: "Road is a river, cars struggling to pass.", lat: -22.5702, lng: 17.0835, address: "Independence Ave, Windhoek" },
  { category: "Water Leak", title: "No tap water at home", description: "No water at our house since the pipe burst up the road.", lat: -22.5699, lng: 17.0838, address: "Independence Ave, Windhoek" },
  { category: "Pothole", title: "Deep pothole near school", description: "Large pothole outside Windhoek Primary School, cars swerving into oncoming traffic.", lat: -22.5750, lng: 17.0900, address: "Sam Nujoma Dr, Windhoek" },
  { category: "Traffic Light", title: "Robot not working", description: "Red light very weak, hard to see at night, intersection is dangerous during rush hour.", lat: -22.5649, lng: 17.0842, address: "Independence Ave & Fidel Castro St" },
  { category: "Garbage", title: "Uncollected garbage for 2 weeks", description: "Bins overflowing on Bahnhof street, attracting pests, cosmetic but smells bad.", lat: -22.5680, lng: 17.0810, address: "Bahnhof St, Windhoek" },
  { category: "Power Outage", title: "No electricity since last night", description: "Whole block of Katutura has had no power since 9pm, exposed wire seen near transformer.", lat: -22.5333, lng: 17.0500, address: "Katutura, Windhoek" },
  { category: "Streetlight", title: "Streetlight out", description: "Streetlight has been off for a week, area is very dark and feels unsafe at night.", lat: -22.5600, lng: 17.0700, address: "Eros, Windhoek" },
];

async function run() {
  const now = new Date().toISOString();

  MINISTRIES.forEach((m) => {
    db.prepare(
      `INSERT INTO ministries (id, name, code, contact_email, is_active) VALUES (?,?,?,?,1)`
    ).run(uuid(), m.name, m.code, m.contact_email);
  });

  LAWS.forEach((law) => {
    db.prepare(
      `INSERT INTO laws (id, title, summary, full_text, published_at) VALUES (?,?,?,?,?)`
    ).run(uuid(), law.title, law.summary, null, now);
  });

  let created = 0;
  let merged = 0;
  for (const r of REPORTS) {
    const result = await createOrMergeReport(db, {
      category: r.category,
      title: r.title,
      description: r.description,
      latitude: r.lat,
      longitude: r.lng,
      addressText: r.address,
      reporterName: "Demo Citizen",
      reporterPhone: "+264810000000",
      createdAt: now,
    });
    if (result.merged) merged++;
    else created++;
  }

  const distinct = db.prepare("SELECT COUNT(*) AS n FROM reports").get().n;
  console.log(
    `Seeded ${MINISTRIES.length} ministries, ${LAWS.length} laws, and ${REPORTS.length} raw reports ` +
      `→ ${distinct} distinct tickets (${merged} merged into nearby duplicates).`
  );
  process.exit(0);
}

run();
