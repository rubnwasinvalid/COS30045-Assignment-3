import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import Papa from "papaparse";

const RAW = path.join("datasets", "datasets_raw", "abs_long_term_conditions_raw.xlsx");
const OUT = path.join("datasets", "datasets_processed", "abs_long_term_conditions_tidy.csv");

function norm(s) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function cleanLabel(s) {
  return String(s ?? "")
    .replace(/\([^)]*\)/g, "")   // remove footnotes like (a)
    .replace(/\s+/g, " ")
    .trim();
}

function toNum(x) {
  const s0 = String(x ?? "").trim();
  if (!s0 || s0 === "-" || s0 === "..") return null;
  const s = s0.replace(/^#/, "").replace(/,/g, "").trim(); // ABS uses #0.1 style
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

function findSheetName(sheetNames) {
  const target = sheetNames.find(n => norm(n) === "table 3.3") || sheetNames.find(n => norm(n).includes("table 3.3"));
  return target ?? sheetNames[0];
}

function findHeaderRow(aoa) {
  // Look for the row that contains several age-group headers like 0–14, 15–24, 25–34, etc.
  const want = ["0–14", "15–24", "25–34", "45–54", "65 years and over"];
  for (let i = 0; i < Math.min(80, aoa.length); i++) {
    const row = (aoa[i] ?? []).map(cleanLabel);
    const rowNorm = row.map(norm);
    const hits = want.filter(w => rowNorm.includes(norm(w))).length;
    if (hits >= 3) return i;
  }
  return -1;
}

function findColIndex(headers, label) {
  const hn = headers.map(norm);
  const idx = hn.indexOf(norm(label));
  if (idx !== -1) return idx;
  // fallback: contains match
  return hn.findIndex(h => h.includes(norm(label)));
}

if (!fs.existsSync(RAW)) {
  throw new Error(`Missing raw ABS file: ${RAW}`);
}

const wb = XLSX.readFile(RAW);
const sheetName = findSheetName(wb.SheetNames);
const ws = wb.Sheets[sheetName];

// Read as array-of-arrays so we can detect header rows reliably
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
if (!aoa.length) throw new Error("ABS XLSX appears empty.");

const headerRowIdx = findHeaderRow(aoa);
if (headerRowIdx === -1) {
  throw new Error(`Could not find the age-group header row in sheet "${sheetName}".`);
}

const headers = (aoa[headerRowIdx] ?? []).map(cleanLabel);

// Choose a small, readable set of age groups for objective A
const AGE_COLS = [
  "0–14",
  "25–34",
  "45–54",
  "65 years and over"
];

const ageColIdx = AGE_COLS
  .map(a => [a, findColIndex(headers, a)])
  .filter(([, idx]) => idx !== -1);

if (ageColIdx.length < 2) {
  throw new Error(
    `Could not locate enough age-group columns. Found: ${ageColIdx.map(d => d[0]).join(", ")} in sheet "${sheetName}".`
  );
}

// Data begins after header row
const dataRows = aoa.slice(headerRowIdx + 1);

// Allowlist the major “Total …” groups (matches your screenshots)
const ALLOW_TOTALS = [
  "Total neoplasms",
  "Total diseases of the blood and blood forming organs",
  "Total endocrine, nutritional and metabolic diseases",
  "Total mental and behavioural conditions",
  "Total diseases of the nervous system",
  "Total diseases of the eye and adnexa",
  "Total diseases of the ear and mastoid",
  "Total diseases of the circulatory system",
  "Total diseases of the respiratory system",
  "Total diseases of the digestive system",
  "Total diseases of the skin and subcutaneous tissue",
  "Total diseases of the musculoskeletal system and connective tissue"
].map(cleanLabel);

const tidy = [];

for (const row of dataRows) {
  if (!row || row.length === 0) continue;

  const labelRaw = cleanLabel(row[0]);
  if (!labelRaw) continue;

  // Keep only the major "Total ..." rows in our allowlist
  const isAllowedTotal = ALLOW_TOTALS.some(t => norm(labelRaw) === norm(t));
  if (!isAllowedTotal) continue;

  // Make a nicer group label (remove leading "Total ")
  const condition_group = labelRaw.replace(/^Total\s+/i, "").trim();

  for (const [age_group, idx] of ageColIdx) {
    const value = toNum(row[idx]);
    if (value == null) continue;
    tidy.push({ age_group, condition_group, proportion: value });
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Papa.unparse(tidy), "utf8");

console.log(`✅ ABS processed -> ${OUT} (${tidy.length} rows) [sheet=${sheetName}]`);
