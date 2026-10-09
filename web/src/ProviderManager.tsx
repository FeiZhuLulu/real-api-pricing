import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Copy,
  DownloadSimple,
  PencilSimple,
  Plus,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import type { Lang, SiteData } from "./types";
import { price } from "./domain";
import {
  copyCustomProvider,
  newProviderId,
  exportCustomProviders,
  parseCustomProviders,
  realPriceUsd,
  safeHttpUrl,
  type CustomProvider,
} from "./customProviders";
import PricingPrompt from "./PricingPrompt";
import { GlassCombobox, GlassSelect, type GlassGroup } from "./GlassSelect";

const CURRENCY_GROUPS: GlassGroup[] = [
  {
    label: "",
    options: [
      { value: "USD", label: "USD $" },
      { value: "CNY", label: "CNY ¥" },
    ],
  },
];

interface DraftModel {
  model: string;
  displayName: string;
  currency: "USD" | "CNY";
  cached: string;
  input: string;
  output: string;
}
interface Draft {
  /** Copies are discarded on close, unlike ordinary recoverable edits. */
  isCopy?: boolean;
  id: string;
  name: string;
  url: string;
  createdAt: string;
  models: DraftModel[];
}

const blankModel = (): DraftModel => ({
  model: "",
  displayName: "",
  currency: "USD",
  cached: "",
  input: "",
  output: "",
});

const toDraft = (p: CustomProvider): Draft => ({
  ...p,
  models: p.models.map((m) => ({
    model: m.model,
    displayName: m.displayName,
    currency: m.currency,
    cached: m.cached === null ? "" : String(m.cached),
    input: String(m.input),
    output: String(m.output),
  })),
});

function downloadText(content: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Unsaved form drafts survive an accidental modal close (backdrop click, Esc):
 * the modal unmounts this panel, so the draft lives in sessionStorage and is
 * restored on the next open. Saving or explicitly going 返回 clears it.
 */
const DRAFT_KEY = "pricing-provider-draft";
function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d: unknown = JSON.parse(raw);
    if (
      !d ||
      typeof d !== "object" ||
      typeof (d as Draft).id !== "string" ||
      !Array.isArray((d as Draft).models)
    )
      return null;
    const draft = d as Draft;
    return {
      id: draft.id,
      name: typeof draft.name === "string" ? draft.name : "",
      url: typeof draft.url === "string" ? draft.url : "",
      createdAt:
        typeof draft.createdAt === "string" && draft.createdAt
          ? draft.createdAt
          : new Date().toISOString().slice(0, 10),
      models: draft.models.map((m) => ({
        model: typeof m?.model === "string" ? m.model : "",
        displayName: typeof m?.displayName === "string" ? m.displayName : "",
        currency: m?.currency === "CNY" ? "CNY" : "USD",
        cached: typeof m?.cached === "string" ? m.cached : "",
        input: typeof m?.input === "string" ? m.input : "",
        output: typeof m?.output === "string" ? m.output : "",
      })),
    };
  } catch {
    return null;
  }
}

export default function CustomProvidersPanel({
  data,
  providers,
  onChange,
  lang,
}: {
  data: SiteData;
  providers: CustomProvider[];
  /** Persists the list; returns false when browser storage rejected it. */
  onChange: (providers: CustomProvider[]) => boolean;
  lang: Lang;
}) {
  const zh = lang === "zh";
  const t = (en: string, cn: string) => (zh ? cn : en);
  const [draft, setDraft] = useState<Draft | null>(loadDraft);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [storageWarn, setStorageWarn] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      if (draft && !draft.isCopy) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* Storage is optional. */
    }
  }, [draft]);

  /** Known served models: slug → display name (for the picker and score badge). */
  const knownModels = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of data.points)
      if (!p.id.startsWith("custom::") && !map.has(p.model))
        map.set(p.model, p.model_display);
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);
  const knownSlugs = useMemo(
    () => new Set(knownModels.map(([slug]) => slug)),
    [knownModels],
  );
  /** Known slugs for the combobox: the slug itself, with its name as hint. */
  const slugOptions = useMemo(
    () => knownModels.map(([slug, display]) => ({ value: slug, label: slug, hint: display })),
    [knownModels],
  );

  const save = (next: CustomProvider[]) => {
    // State still updates when storage fails, so the session keeps working;
    // the warning stays up until a write succeeds.
    setStorageWarn(!onChange(next));
    setNotice("");
    setError("");
  };

  const remove = (id: string) => {
    const p = providers.find((x) => x.id === id);
    if (
      p &&
      confirm(
        t(
          `Delete "${p.name}" and its ${p.models.length} model(s)? This cannot be undone.`,
          `删除「${p.name}」及其 ${p.models.length} 个模型？此操作不可撤销。`,
        ),
      )
    )
      save(providers.filter((x) => x.id !== id));
  };

  const importFile = async (file: File) => {
    try {
      const incoming = parseCustomProviders(await file.text());
      const byId = new Map(providers.map((p) => [p.id, p]));
      for (const p of incoming) byId.set(p.id, p);
      save([...byId.values()]);
      setNotice(
        t(
          `Imported ${incoming.length} provider(s).`,
          `已导入 ${incoming.length} 个供应商。`,
        ),
      );
    } catch (e) {
      setNotice("");
      setError(
        t(
          `Import failed: ${e instanceof Error ? e.message : String(e)}`,
          `导入失败：${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }
  };

  const submitDraft = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      setError(t("Provider name is required.", "请填写供应商名称。"));
      return;
    }
    if (!draft.models.length) {
      setError(t("Add at least one model.", "请至少添加一个模型。"));
      return;
    }
    if (draft.url.trim() && !safeHttpUrl(draft.url)) {
      setError(
        t(
          "Pricing page URL must start with http:// or https://.",
          "定价页链接必须以 http:// 或 https:// 开头。",
        ),
      );
      return;
    }
    const slugs = draft.models.map((m) => m.model.trim());
    if (new Set(slugs).size !== slugs.length) {
      setError(
        t(
          "Each model slug can appear only once per provider.",
          "同一供应商里模型标识不能重复。",
        ),
      );
      return;
    }
    const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
    for (const [i, m] of draft.models.entries()) {
      const label = m.model.trim() || `#${i + 1}`;
      if (!m.model.trim()) {
        setError(t(`Model row ${i + 1}: slug is required.`, `第 ${i + 1} 行：请填写模型标识。`));
        return;
      }
      if (!(Number.isFinite(num(m.input)) && num(m.input) > 0) || !(Number.isFinite(num(m.output)) && num(m.output) > 0)) {
        setError(
          t(
            `${label}: input and output prices must be positive numbers (per MTok).`,
            `${label}：输入与输出价格必须是正数（每 MTok）。`,
          ),
        );
        return;
      }
      if (m.cached.trim() !== "" && !(Number.isFinite(num(m.cached)) && num(m.cached) >= 0)) {
        setError(
          t(
            `${label}: cached price must be a number ≥ 0, or leave it empty to use the input price.`,
            `${label}：缓存读价格必须是 ≥ 0 的数字，留空则按输入价计。`,
          ),
        );
        return;
      }
    }
    const provider: CustomProvider = {
      id: draft.id,
      name,
      url: draft.url.trim(),
      createdAt: draft.createdAt,
      models: draft.models.map((m) => ({
        model: m.model.trim(),
        displayName: m.displayName.trim(),
        currency: m.currency,
        cached: m.cached.trim() === "" ? null : num(m.cached),
        input: num(m.input),
        output: num(m.output),
      })),
    };
    const rest = providers.filter((p) => p.id !== provider.id);
    save([...rest, provider]);
    setDraft(null);
  };

  if (draft) {
    const patchDraft = (update: Partial<Draft>) =>
      setDraft((d) => (d ? { ...d, ...update } : d));
    const patchModel = (i: number, update: Partial<DraftModel>) =>
      setDraft((d) =>
        d
          ? {
              ...d,
              models: d.models.map((m, j) => {
                if (j !== i) return m;
                const next = { ...m, ...update };
                // Picking a known slug offers its display name automatically.
                if (update.model !== undefined) {
                  const known = knownModels.find(([slug]) => slug === update.model);
                  if (known && (!m.displayName || m.displayName === knownModels.find(([slug]) => slug === m.model)?.[1]))
                    next.displayName = known[1];
                }
                return next;
              }),
            }
          : d,
      );
    return (
      <div className="providers-form">
        <p className="panel-description">
          {t(
            "Prices are per million tokens (MTok) in the provider's own listing. The site weights cached/input/output by the standard workload and converts CNY at the project's exchange rate, exactly like the official API points. An unfinished edit is kept as a draft until you save or go back. Unsaved copies are discarded on close.",
            "价格按供应商标价填写（每百万 token）。站点会用与官方 API 点相同的口径折算：缓存读/输入/输出按标准负载加权，人民币按项目汇率换算。未保存的编辑会保留为草稿，直到保存或返回；未保存的副本在关闭时丢弃。",
          )}
        </p>
        <div className="form-fields">
          <label>
            <span>{t("Provider name", "供应商名称")}</span>
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => patchDraft({ name: e.target.value })}
              placeholder={t("e.g. some relay station", "例如：某某中转站")}
            />
          </label>
          <label>
            <span>{t("Pricing page URL (optional)", "定价页链接（可选）")}</span>
            <input
              value={draft.url}
              onChange={(e) => patchDraft({ url: e.target.value })}
              placeholder="https://…"
              inputMode="url"
            />
          </label>
        </div>
        <h3 className="form-section">
          {t("Models & prices", "模型与价格")}
        </h3>
        {draft.models.map((m, i) => (
          <div className="model-row" key={i}>
            <div className="model-row-head">
              <label>
                <span>{t("Model slug", "模型标识")}</span>
                <GlassCombobox
                  value={m.model}
                  onChange={(v) => patchModel(i, { model: v })}
                  options={slugOptions}
                  placeholder="deepseek-v4.1-flash"
                  ariaLabel={t("Model slug", "模型标识")}
                />
              </label>
              <label>
                <span>{t("Display name", "显示名")}</span>
                <input
                  value={m.displayName}
                  onChange={(e) => patchModel(i, { displayName: e.target.value })}
                  placeholder={t("Defaults to the known model's name", "默认同已知模型名")}
                />
              </label>
              <label>
                <span>{t("Currency", "币种")}</span>
                <GlassSelect
                  value={m.currency}
                  groups={CURRENCY_GROUPS}
                  onChange={(v) => patchModel(i, { currency: v as "USD" | "CNY" })}
                  placeholder={t("Currency", "币种")}
                  ariaLabel={t("Currency", "币种")}
                />
              </label>
              <button
                className="icon-button danger"
                title={t("Remove this model", "移除此模型")}
                aria-label={t("Remove this model", "移除此模型")}
                onClick={() =>
                  patchDraft({ models: draft.models.filter((_, j) => j !== i) })
                }
              >
                <Trash size={15} />
              </button>
            </div>
            <div className="model-row-prices">
              {(
                [
                  ["cached", t("Cached read", "缓存读"), t("empty = input price", "留空=输入价")],
                  ["input", t("Input", "输入"), ""],
                  ["output", t("Output", "输出"), ""],
                ] as const
              ).map(([key, label, hint]) => (
                <label key={key}>
                  <span>
                    {label} / MTok{hint ? ` (${hint})` : ""}
                  </span>
                  <input
                    inputMode="decimal"
                    value={m[key]}
                    onChange={(e) => patchModel(i, { [key]: e.target.value })}
                    placeholder="0.00"
                  />
                </label>
              ))}
            </div>
            {m.model.trim() && (
              <small className="model-row-note">
                {knownSlugs.has(m.model.trim())
                  ? t(
                      "Known model — leaderboard scores attach automatically.",
                      "已知模型 —— 将自动关联榜单分数。",
                    )
                  : t(
                      "Unknown model — appears in the price ranking only, no scores.",
                      "未知模型 —— 仅进入单价排名，无榜单分数。",
                    )}
              </small>
            )}
          </div>
        ))}
        <button onClick={() => patchDraft({ models: [...draft.models, blankModel()] })}>
          <Plus size={15} />
          {t("Add a model", "添加模型")}
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="panel-bottom form-actions">
          <button onClick={() => { setDraft(null); setError(""); }}>
            <ArrowLeft size={15} />
            {draft.isCopy ? t("Cancel copy", "取消复制") : t("Back", "返回")}
          </button>
          <button className="primary" onClick={submitDraft}>
            {t("Save provider", "保存供应商")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="providers-panel">
      <p className="panel-description">
        {t(
          "Your own providers (relay stations, resellers) with their models and token prices. They join every view as metered points and reuse the leaderboard scores of known models. Stored only in this browser's localStorage — use export/import to back up or move them.",
          "在这里录入你自己的供应商（各类中转站）及其模型和价格。它们会以按量计费点进入所有视图，命中已知模型时自动复用榜单分数。数据只保存在本浏览器 localStorage，可用导出/导入备份或迁移。",
        )}
      </p>
      {notice && <p className="form-notice" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {storageWarn && (
        <p className="form-error" role="alert">
          {t(
            "Couldn't write to browser storage — these providers will be lost on reload. Export a JSON backup first.",
            "无法写入浏览器存储，刷新页面后这些供应商会丢失，请先导出 JSON 备份。",
          )}
        </p>
      )}
      <div className="providers-list">
        {providers.length === 0 && (
          <p className="providers-empty">
            {t("No custom providers yet.", "还没有自定义供应商。")}
          </p>
        )}
        {providers.map((p) => (
          <div className="provider-card" key={p.id}>
            <div className="provider-card-head">
              <strong>{p.name}</strong>
              {safeHttpUrl(p.url) && (
                <a href={safeHttpUrl(p.url)} target="_blank" rel="noreferrer">
                  {t("Pricing page", "定价页")}
                </a>
              )}
              <button
                className="icon-button"
                title={t("Edit", "编辑")}
                aria-label={t(`Edit ${p.name}`, `编辑 ${p.name}`)}
                onClick={() => { setDraft(toDraft(p)); setError(""); setNotice(""); }}
              >
                <PencilSimple size={15} />
              </button>
              <button
                className="icon-button"
                title={t("Copy provider", "复制供应商")}
                aria-label={t(`Copy ${p.name}`, `复制 ${p.name}`)}
                onClick={() => {
                  setDraft({ ...toDraft(copyCustomProvider(p, t("(copy)", "（副本）"))), isCopy: true });
                  setError("");
                  setNotice("");
                }}
              >
                <Copy size={15} />
              </button>
              <button
                className="icon-button danger"
                title={t("Delete", "删除")}
                aria-label={t(`Delete ${p.name}`, `删除 ${p.name}`)}
                onClick={() => remove(p.id)}
              >
                <Trash size={15} />
              </button>
            </div>
            <div className="provider-models">
              {p.models.map((m, i) => (
                <div className="provider-model" key={i}>
                  <span>
                    {m.displayName || m.model}
                    <small>
                      {m.currency === "CNY" ? "¥" : "$"}
                      {m.cached ?? m.input} / {m.input} / {m.output}
                      {t(" per MTok (cached/in/out)", " 每 MTok（缓存/输入/输出）")}
                    </small>
                  </span>
                  <span className="provider-model-meta">
                    {knownSlugs.has(m.model) ? (
                      <em>{t("scored", "含分数")}</em>
                    ) : (
                      <em className="unscored-tag">{t("price only", "仅价格")}</em>
                    )}
                    <strong>{price(realPriceUsd(m, data.conventions))}</strong>
                    <small>/ MTok</small>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="panel-bottom form-actions">
        <button onClick={() => fileInput.current?.click()}>
          <UploadSimple size={15} />
          {t("Import JSON", "导入 JSON")}
        </button>
        <button
          onClick={() =>
            downloadText(
              exportCustomProviders(providers),
              "custom-providers.json",
              "application/json",
            )
          }
          disabled={!providers.length}
        >
          <DownloadSimple size={15} />
          {t("Export JSON", "导出 JSON")}
        </button>
        <button
          className="primary"
          onClick={() => {
            setDraft({
              id: newProviderId(),
              name: "",
              url: "",
              createdAt: new Date().toISOString().slice(0, 10),
              models: [blankModel()],
            });
            setError("");
            setNotice("");
          }}
        >
          <Plus size={15} />
          {t("New provider", "新建供应商")}
        </button>
      </div>
      <PricingPrompt knownModels={knownModels} lang={lang} />
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
