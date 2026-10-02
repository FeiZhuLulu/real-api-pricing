import { chmod, copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { build } from "esbuild";
import { buildSiteData } from "../../scripts/lib/build-site-data.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const repo = path.resolve(root, "..");
const { data } = await buildSiteData({ repo, parseCsv: parse });
await mkdir(path.join(root, "data"), { recursive: true });
await writeFile(path.join(root, "data/site.json"), JSON.stringify(data));
await copyFile(path.join(repo, "LICENSE"), path.join(root, "LICENSE"));
await build({
  entryPoints: [path.join(root, "src/main.ts")],
  outfile: path.join(root, "dist/main.js"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  packages: "external",
  sourcemap: true,
});
await chmod(path.join(root, "dist/main.js"), 0o755);
// npm pack --json reserves stdout for its machine-readable package manifest.
console.error(
  `CLI built: ${data.points.length} points, ${data.configurations.length} configurations, ${data.mappings.length} references. Values verified against adopted.csv.`,
);
