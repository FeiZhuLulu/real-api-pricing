import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { buildSiteData } from "../../scripts/lib/build-site-data.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const repo = path.resolve(root, "..");
const out = path.join(root, "public/data");
const read = async (p) =>
  JSON.parse(await readFile(path.join(repo, p), "utf8"));
const { data, evidenceToCopy } = await buildSiteData({ repo, parseCsv: parse });
await mkdir(path.join(out, "evidence"), { recursive: true });
await writeFile(path.join(out, "site.json"), JSON.stringify(data));
for (const f of [
  "data/adopted.csv",
  "derived/points.json",
  "derived/points.csv",
  "derived/benchmark-configurations.json",
  "derived/benchmark-configurations.csv",
  "derived/benchmark-points.json",
  "derived/benchmark-points.csv",
  "data/conventions.json",
]) {
  const destination = path.join(out, path.basename(f));
  if (f.endsWith(".json"))
    await writeFile(destination, JSON.stringify(await read(f)));
  else await copyFile(path.join(repo, f), destination);
}
for (const f of evidenceToCopy)
  await copyFile(
    path.join(repo, "data/research", f),
    path.join(out, "evidence", f),
  );
console.log(
  `Website data: ${data.points.length} points, ${data.configurations.length} configurations, ${data.mappings.length} references, ${evidenceToCopy.size} evidence files. Values verified against adopted.csv.`,
);
