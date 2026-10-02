import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// Both the website and the offline CLI publish this same validated snapshot.
// Inject the CSV parser so this shared adapter has no package dependencies.
export async function buildSiteData({ repo, parseCsv }) {
  const read = async (p) =>
    JSON.parse(await readFile(path.join(repo, p), "utf8"));
  const [
    points,
    configurations,
    mappings,
    conventions,
    adoptedText,
    evidenceFiles,
    channelColors,
    i18n,
  ] = await Promise.all([
    read("derived/points.json"),
    read("derived/benchmark-configurations.json"),
    read("derived/benchmark-points.json"),
    read("data/conventions.json"),
    readFile(path.join(repo, "data/adopted.csv"), "utf8"),
    readdir(path.join(repo, "data/research")),
    read("config/channel-colors.json"),
    read("data/i18n/adopted.en.json"),
  ]);
  const adopted = new Map(
    parseCsv(adoptedText, { columns: true, skip_empty_lines: true, bom: true }).map(
      (p) => [`${p.plan_id}::${p.served_model}`, p],
    ),
  );
  const configById = new Map(configurations.map((c) => [c.configuration_id, c]));
  const pointIds = new Set(points.points.map((p) => p.id));
  if (
    pointIds.size !== points.points.length ||
    adopted.size !== points.points.length
  )
    throw new Error("Duplicate points or adopted/points count mismatch");
  for (const m of mappings)
    if (!pointIds.has(m.point_id) || !configById.has(m.configuration_id))
      throw new Error("Orphan benchmark mapping");
  // English translations of adoption source/decision text; a Chinese string
  // without a non-empty translation is a hard error (verify_i18n.py mirrors it).
  const enMap = new Map(i18n.entries.map((e) => [e.zh, e.en]));
  const zhMap = new Map(i18n.entries.map((e) => [e.en, e.zh]));
  const CJK = /[㐀-鿿]/;
  const enOf = (zh) => {
    if (zh == null || zh === "") return zh;
    // Strings without CJK pass through, with fullwidth punctuation normalized
    // to ASCII for the English UI.
    if (!CJK.test(zh))
      return zh
        .replaceAll("；", "; ")
        .replaceAll("，", ", ")
        .replaceAll("（", "(")
        .replaceAll("）", ")");
    const en = enMap.get(zh);
    if (!en) throw new Error(`No English translation for: ${zh.slice(0, 60)}`);
    return en;
  };
  // English-only raw_record notes carry their Chinese translation on the zh side
  // of the same {zh, en} entries (verify_i18n.py enforces both directions).
  const zhOf = (en) => {
    const zh = zhMap.get(en);
    if (!zh || !CJK.test(zh))
      throw new Error(`No Chinese translation for: ${en.slice(0, 60)}`);
    return zh;
  };
  const evidenceToCopy = new Set();
  // id 前缀 → 渠道与 Python 侧共用 config/channel-colors.json 的 channels 数组。
  const channelPrefixes = channelColors.channels;
  const channel = (p) =>
    channelPrefixes.find(([prefix]) => p.id.startsWith(prefix))?.[1] || p.vendor;
  const data = {
    version: 1,
    generatedAt: points.generatedAt,
    boards: points.boards,
    conventions,
    points: points.points.map((p) => {
      const a = adopted.get(p.id);
      if (
        !a ||
        Number(a.real_usd_per_mtok) !== p.real_usd_per_mtok ||
        (a.price_usd === "" ? null : Number(a.price_usd)) !== p.price_usd ||
        (a.monthly_yi === "" ? null : Number(a.monthly_yi)) !== p.monthly_yi
      )
        throw new Error(`Adoption mismatch: ${p.id}`);
      const text = `${a.source} ${a.decision_note}`;
      const evidence = evidenceFiles
        .filter((f) => f.endsWith(".json") && text.includes(f))
        .map((f) => {
          evidenceToCopy.add(f);
          return { label: f, url: `/data/evidence/${f}` };
        });
      const urls = [
        ...new Set(
          text.match(/https?:\/\/[^\s<>"'\u3000-\u9fff\uff00-\uffef]+/g) || [],
        ),
      ].map((url) => ({ label: url, url: url.replace(/[;,.]+$/, "") }));
      // Score summaries are already represented losslessly by configurations + mappings.
      // Keep the web point record lean instead of repeating four boards of metadata per point.
      const base = Object.fromEntries(
        Object.entries(p).filter(([key]) => !key.includes("__")),
      );
      return {
        ...base,
        plan_id: a.plan_id,
        channel: channel(p),
        original_price: a.price === "" ? null : Number(a.price),
        currency: a.currency,
        monthly_tokens: a.monthly_tokens === "" ? null : Number(a.monthly_tokens),
        decision_note: a.decision_note,
        source_en: enOf(p.source),
        decision_note_en: enOf(a.decision_note),
        note_en: enOf(p.note),
        evidence: [...urls, ...evidence],
      };
    }),
    configurations: configurations.map(({ raw_record, ...c }) => {
      const out = { ...c };
      if ("source" in c) out.source_en = enOf(c.source);
      if (raw_record?.variantLabel) out.board_label = raw_record.variantLabel;
      const note = raw_record?.note;
      if (note) {
        if (CJK.test(note)) {
          out.record_note_zh = note;
          out.record_note_en = enOf(note);
        } else {
          out.record_note_en = note;
          out.record_note_zh = zhOf(note);
        }
      }
      if (c.archive) {
        if (!evidenceFiles.includes(c.archive))
          throw new Error(`Archive file missing from data/research: ${c.archive}`);
        evidenceToCopy.add(c.archive);
        out.archive_url = `/data/evidence/${c.archive}`;
      }
      return out;
    }),
    mappings: mappings.map((m) => {
      const config = configById.get(m.configuration_id);
      const rec = Object.fromEntries(Object.entries(m).filter(([key, value]) =>
        key === "configuration_id" || !(key in config) || config[key] !== value,
      ));
      // Fields dropped by the de-dup filter are inherited from the configuration;
      // only the record that actually carries `source` gets a translation.
      if ("source" in rec) rec.source_en = enOf(rec.source);
      return rec;
    }),
  };
  return { data, evidenceToCopy };
}
