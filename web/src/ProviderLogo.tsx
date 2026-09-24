import type { Point } from "./types";
import { isThirdParty, manufacturer } from "./domain";
import { useTheme, type Theme } from "./theme";

export type LogoTone = Theme;

const svgSources = import.meta.glob<string>("./assets/provider-logos/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
});
const rasters = import.meta.glob<string>("./assets/provider-logos/*.webp", {
  eager: true,
  query: "?inline",
  import: "default",
});
const slugs: Record<string, string> = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  xAI: "xai",
  Cursor: "cursor",
  Kimi: "kimi",
  Zhipu: "zhipu",
  GLM: "zhipu",
  MiniMax: "minimax",
  Alibaba: "alibaba",
  OpenCode: "opencode",
  DeepSeek: "deepseek",
  Google: "google",
  "Command Code": "command-code",
  Ollama: "ollama",
  Xiaomi: "xiaomi",
  Tencent: "tencent",
  Meta: "meta",
  Microsoft: "microsoft",
  Meituan: "meituan",
  Muse: "meta",
  StepFun: "stepfun",
  Step: "stepfun",
  Devin: "devin",
};
/**
 * Marks drawn in near-black ink. On a dark surface they would vanish, so the
 * dark variant swaps that ink for a light one (and any white knock-out for the
 * surface). Tile logos (Zhipu, OpenCode, StepFun) keep their own background.
 */
const MONO = new Set([
  "openai",
  "anthropic",
  "xai",
  "cursor",
  "ollama",
  "kimi",
  "devin",
  "meituan",
]);
const DARK_INK = /#(?:111111|111|191919|0e0e0e)\b/gi;
const svgUrl = (text: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
const cache = new Map<string, string | undefined>();

const slugOf = (provider: string) =>
  slugs[provider] ?? provider.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/**
 * Bundled logo as a self-contained data URL (no network), so the same source
 * works in the page, in SVG `<image>` and inside exported files.
 */
export function providerLogoUrl(
  provider: string,
  tone: LogoTone = "light",
): string | undefined {
  const slug = slugOf(provider);
  const key = `${slug}|${tone}`;
  if (cache.has(key)) return cache.get(key);
  let url = rasters[`./assets/provider-logos/${slug}.webp`];
  const raw = svgSources[`./assets/provider-logos/${slug}.svg`];
  if (!url && raw) {
    const text =
      tone === "dark" && MONO.has(slug)
        ? raw
            .replace(DARK_INK, "#ECEEF1")
            .replace(/currentColor/g, "#ECEEF1")
            .replace(/fill="#fff(?:fff)?"/gi, 'fill="#171A1E"')
        : raw.replace(/currentColor/g, "#111111");
    url = svgUrl(text);
  }
  cache.set(key, url);
  return url;
}

export default function ProviderLogo({
  provider,
  size = 28,
}: {
  provider: string;
  size?: number;
}) {
  const src = providerLogoUrl(provider, useTheme());
  return (
    <span
      className="provider-logo"
      title={provider}
      role="img"
      aria-label={provider}
      style={size !== 28 ? { width: size, height: size, flexBasis: size } : undefined}
    >
      {src ? (
        <img src={src} alt="" width={size} height={size} decoding="async" />
      ) : (
        <span aria-hidden="true">{provider.slice(0, 2)}</span>
      )}
    </span>
  );
}
export function BrandMarks({
  point,
  size,
}: {
  point: Point;
  size?: number;
}) {
  const maker = manufacturer(point.vendor);
  if (!isThirdParty(point)) return <ProviderLogo provider={maker} size={size} />;
  return (
    <span className="brand-pair">
      <ProviderLogo provider={point.channel} size={size} />
      <ProviderLogo provider={maker} size={size} />
    </span>
  );
}
