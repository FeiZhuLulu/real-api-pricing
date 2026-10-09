import { useRef, useState } from "react";
import { Copy } from "@phosphor-icons/react";
import type { Lang } from "./types";
import { buildPricingPrompt } from "./pricingPrompt";
import { copyText } from "./clipboard";

/** Local-only prompt builder; never contacts the supplied pricing page. */
export default function PricingPrompt({ knownModels, lang }: {
  knownModels: [string, string][];
  lang: Lang;
}) {
  const t = (en: string, zh: string) => lang === "zh" ? zh : en;
  const [url, setUrl] = useState("");
  const [scope, setScope] = useState("");
  const [prompt, setPrompt] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const textArea = useRef<HTMLTextAreaElement>(null);
  const request = useRef(0);
  const reset = () => {
    request.current += 1;
    setBusy(false);
    setPrompt("");
    setNotice("");
    setError("");
  };
  const generate = async () => {
    const current = ++request.current;
    setError("");
    setNotice("");
    let next: string;
    try {
      next = buildPricingPrompt({ url, scope, knownModels, lang });
    } catch {
      setPrompt("");
      setError(t(
        "Enter a public http:// or https:// pricing URL without login credentials.",
        "请填写公开的 http:// 或 https:// 定价页链接，不要包含登录凭据。",
      ));
      return;
    }
    setPrompt(next);
    setBusy(true);
    const copied = await copyText(next);
    if (current !== request.current) return;
    setBusy(false);
    setNotice(copied
      ? t("Prompt copied. Paste it into an agent with browsing, then review and import its JSON.", "已复制提示词。粘贴给能浏览网页的智能体，核对结果后导入 JSON。")
      : t("Clipboard unavailable. Select the prompt below and copy it manually.", "剪贴板不可用。请选中下方提示词并手动复制。"));
    if (!copied) {
      textArea.current?.focus();
      textArea.current?.select();
    }
  };
  return (
    <details className="pricing-prompt">
      <summary>{t("Get prices with an AI prompt", "用提示词查价")}</summary>
      <div className="providers-form">
        <p className="panel-description">
          {t(
            "For New API / Sub2API sites. This only copies instructions for another agent; this site does not fetch the URL. /pricing is an example page path, not a standard API. Check the prices before importing.",
            "适用于 New API / Sub2API 站点。这里只生成给其他智能体的提示词，本站不会请求该链接。/pricing 只是示例页面路径，不是通用 API；导入前请核对报价。",
          )}
        </p>
        <div className="form-fields">
          <label>
            <span>{t("Public pricing page URL", "公开定价页链接")}</span>
            <input inputMode="url" value={url} placeholder="https://example.com/pricing"
              onChange={(e) => { reset(); setUrl(e.target.value); }} />
          </label>
          <label>
            <span>{t("Groups / models (optional)", "分组 / 模型范围（可选）")}</span>
            <input value={scope} placeholder={t("All public groups and models", "所有公开分组和模型")}
              onChange={(e) => { reset(); setScope(e.target.value); }} />
          </label>
        </div>
        <button onClick={() => void generate()} disabled={busy}>
          <Copy size={15} />{t("Copy pricing prompt", "复制查价提示词")}
        </button>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-notice" role="status">{notice}</p>}
        {prompt && <label className="pricing-prompt-output">
          <span>{t("Generated prompt (select to copy)", "生成的提示词（可选中复制）")}</span>
          <textarea ref={textArea} readOnly value={prompt} rows={10} />
        </label>}
      </div>
    </details>
  );
}
