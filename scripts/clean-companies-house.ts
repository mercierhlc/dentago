import * as fs from "fs";
import * as path from "path";

const CSV_PATH = path.join(process.env.HOME!, "Downloads", "Companies-House-search-results.csv");
const OUTPUT_PATH = path.join(process.env.HOME!, "Downloads", "companies-cleaned.json");

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = "";
    } else { current += ch; }
  }
  result.push(current);
  return result;
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter((l) => l.trim());
  const headers = parseCSVLine(lines[0].replace(/^\uFEFF/, ""));
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.replace(/^\uFEFF/, "")] = (values[i] ?? "").trim(); });
    return row;
  });
}

function cleanCompanyName(name: string): string {
  return name
    // Remove legal suffixes
    .replace(/\b(LIMITED|LTD|PLC|LLP|LP|CIC|CIO|UNLTD|UNLIMITED)\b\.?/gi, "")
    // Remove trailing punctuation and whitespace
    .replace(/[,.\-]+$/, "")
    .trim()
    // Title case
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    // Fix common dental abbreviations
    .replace(/\bNhs\b/g, "NHS")
    .replace(/\bUk\b/g, "UK")
    .trim();
}

function main() {
  const content = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parseCSV(content);

  const active = rows.filter((r) => r.company_status?.toLowerCase() === "active");
  console.log(`📋 ${rows.length} total | ${active.length} active`);

  const cleaned = active
    .map((r) => cleanCompanyName(r.company_name))
    .filter((name) => name.length > 2);

  // Deduplicate
  const unique = [...new Set(cleaned)];
  console.log(`✅ ${unique.length} unique cleaned names`);

  // Save as JSON array (ready to paste into Apify)
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(unique, null, 2));
  console.log(`💾 Saved to ${OUTPUT_PATH}`);

  // Preview first 10
  console.log("\nSample:");
  unique.slice(0, 10).forEach((n, i) => console.log(`  ${i + 1}. ${n}`));
}

main();
