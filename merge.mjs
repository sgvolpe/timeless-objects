// Merge parts/*.json into site/timeless-objects.json: validate, dedupe by slug, sort, assign ids.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REQUIRED = ["slug", "name", "category", "invention", "place_of_invention", "inventor",
  "short_description", "description", "why_unchanged", "materials", "faqs",
  "image", "tags", "confidence"];
const ERAS = new Set(["Prehistoric", "Ancient", "Medieval", "Early Modern", "Industrial", "Modern"]);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const items = [], seen = new Map(), dupes = [], problems = [];
const partsDir = join(HERE, "parts");
for (const file of readdirSync(partsDir).filter((f) => f.endsWith(".json")).sort()) {
  let arr;
  try {
    arr = JSON.parse(readFileSync(join(partsDir, file), "utf8"));
  } catch (e) {
    problems.push(`${file}: invalid JSON (${e.message})`);
    continue;
  }
  for (const obj of arr) {
    delete obj.id;
    const missing = REQUIRED.filter((k) => !(k in obj));
    if (missing.length) { problems.push(`${file} ${obj.name}: missing ${missing}`); continue; }
    if (!Number.isInteger(obj.invention?.year)) problems.push(`${obj.name}: invention.year not int`);
    if (!ERAS.has(obj.invention?.era)) problems.push(`${obj.name}: bad era ${obj.invention?.era}`);
    if (obj.faqs.length !== 3) problems.push(`${obj.name}: ${obj.faqs.length} faqs`);
    obj.slug = norm(obj.slug);
    if (seen.has(obj.slug)) { dupes.push(`${obj.name} (${obj.category}) dup of ${seen.get(obj.slug)}`); continue; }
    seen.set(obj.slug, obj.category);
    items.push(obj);
  }
}

items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
const out = items.map((o, i) => ({ id: i + 1, ...o }));
writeFileSync(join(HERE, "site", "timeless-objects.json"), JSON.stringify(out, null, 2), "utf8");

console.log(`total unique: ${out.length}`);
console.log(`duplicates dropped: ${dupes.length}`);
dupes.forEach((d) => console.log("  DUP", d));
console.log(`problems: ${problems.length}`);
problems.forEach((p) => console.log("  !", p));
