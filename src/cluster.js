const CLUSTER_RADIUS_METERS = 60;

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Coarse cluster key (category + ~100m grid cell), stored on each report for future
// indexing. NOT used as the merge gate — grid boundaries and float rounding can split
// two reports metres apart into different cells — the haversine check below is the gate.
function clusterKey(category, latitude, longitude) {
  if (latitude == null || longitude == null) return null;
  return `${category}:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
}

function findNearbyOpenReport(db, { category, latitude, longitude }) {
  if (latitude == null || longitude == null) return null;

  // Scan open reports of the same category and merge on true distance. O(n) per submit,
  // which is trivial at MVP volume and avoids grid-boundary misses entirely.
  const candidates = db
    .prepare(
      `SELECT * FROM reports
       WHERE category = ? AND latitude IS NOT NULL
         AND status != 'RESOLVED' AND status != 'REJECTED'`
    )
    .all(category);

  return (
    candidates.find(
      (r) => haversineMeters(latitude, longitude, r.latitude, r.longitude) <= CLUSTER_RADIUS_METERS
    ) || null
  );
}

module.exports = { clusterKey, findNearbyOpenReport, haversineMeters };
