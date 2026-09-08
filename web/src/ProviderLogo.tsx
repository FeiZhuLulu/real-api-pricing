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
