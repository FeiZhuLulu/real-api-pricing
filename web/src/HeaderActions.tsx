import { useEffect, useState } from "react";
import { NotePencil, Star } from "@phosphor-icons/react";
import type { Lang } from "./types";

const REPO = "https://github.com/FeiZhuLulu/real-api-pricing";
const REPO_API = "https://api.github.com/repos/FeiZhuLulu/real-api-pricing";
const STARS_KEY = "pricing-stars";
const STARS_TTL = 6 * 60 * 60 * 1000;
/** After a failed request (typically the anonymous rate limit), wait before retrying. */
const RETRY_AFTER = 60 * 60 * 1000;

interface StarCache {
  count: number | null;
  at: number;
  failedAt?: number;
}
function cachedStars(): StarCache | null {
  try {
    const raw = localStorage.getItem(STARS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as { at?: unknown }).at === "number"
    ) {
      const c = parsed as StarCache;
      return { ...c, count: typeof c.count === "number" ? c.count : null };
    }
    return null;
  } catch {
    return null;
  }
}

function saveStars(cache: StarCache) {
  try {
    localStorage.setItem(STARS_KEY, JSON.stringify(cache));
  } catch {
    /* Storage is optional. */
  }
}

function contributeIssueUrl(): string {
  const title = "补充数据 / Contribute evidence";
  const params = new URLSearchParams({ title, template: "contribute-data.md" });
  return `${REPO}/issues/new?${params.toString()}`;
}

export default function HeaderActions({ lang }: { lang: Lang }) {
  const [stars, setStars] = useState<number | null>(() => cachedStars()?.count ?? null);
  const zh = lang === "zh";

  useEffect(() => {
    const cached = cachedStars();
    const now = Date.now();
    if (cached && cached.count !== null && now - cached.at < STARS_TTL) return;
    if (cached?.failedAt && now - cached.failedAt < RETRY_AFTER) return;
    const abort = new AbortController();
    // The star count is decoration: fetch it once the page is idle.
    const hasIdle = typeof window.requestIdleCallback === "function";
    const idle = (cb: () => void) =>
      hasIdle ? window.requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 1500);
    const handle = idle(() => {
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
            saveStars({ count: data.stargazers_count, at: Date.now() });
          }
        })
        .catch((e: unknown) => {
          if (e instanceof Error && e.name === "AbortError") return;
          saveStars({ count: cached?.count ?? null, at: cached?.at ?? 0, failedAt: Date.now() });
        });
    });
    return () => {
      abort.abort();
      if (hasIdle) window.cancelIdleCallback(handle as number);
      else clearTimeout(handle);
    };
  }, []);

  const count =
    stars === null
      ? null
      : new Intl.NumberFormat(zh ? "zh-CN" : "en-US", { notation: "compact" }).format(stars);

  return (
    <>
      <a
        className="header-contribute"
        href={contributeIssueUrl()}
        target="_blank"
        rel="noreferrer"
        title={zh ? "通过 GitHub Issue 补充数据" : "Contribute evidence via a GitHub issue"}
      >
        <NotePencil size={16} />
        <span>{zh ? "补充数据" : "Contribute"}</span>
      </a>
      <a className="header-star" href={REPO} target="_blank" rel="noreferrer">
        <Star size={15} weight="fill" />
        <span>Star</span>
        <span className="sr-only">{zh ? "（在 GitHub 上）" : " on GitHub"}</span>
        {count !== null && <span className="star-count">{count}</span>}
      </a>
    </>
  );
}
