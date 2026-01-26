import fs from "fs";
import path from "path";
import Papa from "papaparse";

const RAW = path.join("datasets", "datasets_raw", "oecd_life_expectancy_raw.csv");
const OUT = path.join("datasets", "datasets_processed", "oecd_life_expectancy_aus.csv");

function toNum(x) {
  const v = Number(String(x ?? "").replace(/,/g, "").trim());
  return Number.isFinite(v) ? v : null;
}

if (!fs.existsSync(RAW)) {
  throw new Error(`Missing raw OECD file: ${RAW}`);
}

const csvText = fs.readFileSync(RAW, "utf8");
const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

const rows = parsed.data;
const headers = parsed.meta.fields ?? Object.keys(rows[0] ?? {});
if (!headers.length) throw new Error("OECD CSV has no headers / is empty.");

// REF_AREA, TIME_PERIOD, OBS_VALUE, MEASURE, UNIT_MEASURE, AGE, SEX, etc.
if (!headers.includes("REF_AREA") || !headers.includes("TIME_PERIOD") || !headers.includes("OBS_VALUE")) {
  throw new Error(
    `Expected columns REF_AREA, TIME_PERIOD, OBS_VALUE not found.\nHeaders: ${headers.join(", ")}`
  );
}

// Keep only Australia rows (OECD code AUS)
// Then keep only valid numeric year/value.
const filtered = rows
  .filter(r => String(r.REF_AREA ?? "").trim() === "AUS")
  .map(r => ({
    year: toNum(r.TIME_PERIOD),
    value: toNum(r.OBS_VALUE)
  }))
  .filter(d => d.year != null && d.value != null)
  .sort((a, b) => a.year - b.year);

// Deduplicate by year (keep last)
const byYear = new Map();
for (const d of filtered) byYear.set(d.year, d.value);

const outRows = [...byYear.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([year, value]) => ({ year, value }));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Papa.unparse(outRows), "utf8");

console.log(`✅ OECD processed -> ${OUT} (${outRows.length} rows)`);
