import type { Point } from "./types";
import { isThirdParty, manufacturer } from "./domain";
const files = {
  ...import.meta.glob<string>("./assets/provider-logos/*.svg", {
    eager: true,
    query: "?url",
    import: "default",
  }),
  ...import.meta.glob<string>("./assets/provider-logos/*.png", {
    eager: true,
    query: "?inline",
    import: "default",
  }),
};
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
};
/** Local provider logo URL from the bundled asset glob (no external fetch). */
export function providerLogoUrl(provider: string): string | undefined {
  const slug =
    slugs[provider] ?? provider.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    files[`./assets/provider-logos/${slug}.png`] ??
    files[`./assets/provider-logos/${slug}.svg`]
  );
}

const logoDataCache = new Map<string, Promise<string>>();

async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const hit = logoDataCache.get(url);
  if (hit) return hit;
  const job = fetch(url)
    .then(async (res) => {
      if (!res.ok) return url;
      const ctype = res.headers.get("content-type") ?? "";
      if (ctype.includes("svg") || url.includes(".svg")) {
        const text = await res.text();
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
      }
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    })
    .catch(() => url);
  logoDataCache.set(url, job);
  return job;
}

/** Inlined logo sources, so chart exports carry their artwork. */
export async function logoUrlMap(
  providers: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await Promise.all(
    [...new Set(providers)].map(async (provider) => {
      const url = providerLogoUrl(provider);
      if (url) map.set(provider, await toDataUrl(url));
    }),
  );
  return map;
}

export default function ProviderLogo({ provider }: { provider: string }) {
  const src = providerLogoUrl(provider);
  return (
    <span className="provider-logo" title={provider} aria-label={provider}>
      {src ? (
        <img src={src} alt="" />
      ) : (
        <span aria-hidden="true">{provider.slice(0, 2)}</span>
      )}
    </span>
  );
}
export function BrandMarks({ point }: { point: Point }) {
  const maker = manufacturer(point.vendor);
  if (!isThirdParty(point)) return <ProviderLogo provider={maker} />;
  return (
    <span className="brand-pair">
      <ProviderLogo provider={point.channel} />
      <ProviderLogo provider={maker} />
    </span>
  );
}
