import { useEffect, useState } from "react";
import { NotePencil, Star } from "@phosphor-icons/react";
import type { Lang } from "./types";

const REPO = "https://github.com/FeiZhuLulu/real-api-pricing";
const REPO_API = "https://api.github.com/repos/FeiZhuLulu/real-api-pricing";

function contributeIssueUrl(): string {
  const title = "补充数据 / Contribute evidence";
  const params = new URLSearchParams({ title, template: "contribute-data.md" });
  return `${REPO}/issues/new?${params.toString()}`;
}

export default function HeaderActions({ lang }: { lang: Lang }) {
  const [stars, setStars] = useState<number | null>(null);
  const zh = lang === "zh";

  useEffect(() => {
    const abort = new AbortController();
    fetch(REPO_API, {
      signal: abort.signal,
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { stargazers_count?: unknown }) => {
        if (typeof data.stargazers_count === "number") {
          setStars(data.stargazers_count);
        }
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "AbortError") return;
        /* Keep the Star link; omit the count on failure. */
      });
    return () => abort.abort();
  }, []);

  const count =
    stars === null
      ? null
      : new Intl.NumberFormat(zh ? "zh-CN" : "en-US").format(stars);

  return (
    <>
      <a
        className="header-contribute"
        href={contributeIssueUrl()}
        target="_blank"
        rel="noreferrer"
        aria-label={t(
          zh,
          "Contribute evidence via GitHub Issue",
          "通过 GitHub Issue 补充数据",
        )}
      >
        <NotePencil size={16} />
        <span>{zh ? "补充数据" : "Contribute"}</span>
      </a>
      <a
        className="header-star"
        href={REPO}
        target="_blank"
        rel="noreferrer"
        aria-label={
          count === null
            ? t(zh, "Star on GitHub", "在 GitHub 上 Star")
            : t(
                zh,
                `Star on GitHub, ${count} stars`,
                `在 GitHub 上 Star，${count} 星`,
              )
        }
      >
        <Star size={16} weight="fill" />
        <span>Star</span>
        {count !== null && <span className="star-count">{count}</span>}
      </a>
    </>
  );
}

function t(zh: boolean, en: string, cn: string) {
  return zh ? cn : en;
}
