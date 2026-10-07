import type { Point } from "./types";
import ProviderLogo from "./ProviderLogo";
import { GlassSelect, type GlassGroup, type GlassOption } from "./GlassSelect";
import { useTheme } from "./theme";
import { dotColors } from "./palette";
import { color, displayPlan, manufacturer, planKey, price } from "./domain";

export { planKey };
/** Model-select value that stands for every model of the chosen plan. */
export const ALL_MODELS = "*";

/** Plans offered by the pickers, grouped by channel for the group headers. */
export function planOptions(points: Point[]) {
  const plans = new Map<string, Point[]>();
  for (const p of points)
    if (!plans.get(planKey(p))?.some((q) => q.id === p.id))
      plans.set(planKey(p), [...(plans.get(planKey(p)) ?? []), p]);
  const channels = new Map<string, string[]>();
  for (const [key, ps] of plans)
    channels.set(ps[0].channel, [...(channels.get(ps[0].channel) ?? []), key]);
  for (const keys of channels.values())
    keys.sort(
      (a, b) =>
        (plans.get(a)![0].price_usd ?? Infinity) - (plans.get(b)![0].price_usd ?? Infinity) ||
        a.localeCompare(b),
    );
  return { plans, channels, channelOrder: [...channels.keys()].sort((a, b) => a.localeCompare(b)) };
}

/**
 * Two dependent pickers: a plan first, then one of its models. Nothing is
 * chosen until the user has picked both.
 */
export default function PlanModelPicker({
  options,
  plan,
  model,
  zh,
  allowAll = false,
  onPlan,
  onModel,
}: {
  options: ReturnType<typeof planOptions>;
  plan: string;
  model: string;
  zh: boolean;
  allowAll?: boolean;
  onPlan: (plan: string) => void;
  onModel: (model: string) => void;
}) {
  const lang = zh ? "zh" : "en";
  const dark = useTheme() === "dark";
  const models = [...(options.plans.get(plan) ?? [])].sort((a, b) =>
    a.model_display.localeCompare(b.model_display),
  );
  const planGroups: GlassGroup[] = options.channelOrder.map((c) => {
    const first = options.plans.get(options.channels.get(c)![0])![0];
    return {
      label: c,
      icon: <i className="gs-dot" style={{ background: dotColors(color(first), dark).fill }} />,
      options: options.channels.get(c)!.map((key) => {
        const p = options.plans.get(key)![0];
        return {
          value: key,
          label: displayPlan(p.plan, lang),
          hint: `${price(p.price_usd)}${zh ? "/月" : "/mo"}`,
        };
      }),
    };
  });
  const modelOptions: GlassOption[] = [
    ...(allowAll && models.length > 1
      ? [
          {
            value: ALL_MODELS,
            label: zh
              ? `该套餐全部模型（${models.length}）`
              : `All models in this plan (${models.length})`,
          },
        ]
      : []),
    ...models.map((m) => ({
      value: m.id,
      label: m.model_display,
      icon: <ProviderLogo provider={manufacturer(m.vendor)} size={18} />,
    })),
  ];
  return (
    <>
      <label>
        <span className="sr-only">{zh ? "套餐" : "Plan"}</span>
        <GlassSelect
          value={plan}
          groups={planGroups}
          onChange={onPlan}
          placeholder={zh ? "选择套餐…" : "Choose a plan…"}
          ariaLabel={zh ? "套餐" : "Plan"}
          searchable
          searchPlaceholder={zh ? "搜索套餐或渠道…" : "Search plans or channels…"}
          emptyText={zh ? "无匹配" : "No matches"}
        />
      </label>
      <label>
        <span className="sr-only">{zh ? "模型" : "Model"}</span>
        <GlassSelect
          value={model}
          groups={[{ label: "", options: modelOptions }]}
          onChange={onModel}
          placeholder={
            plan ? (zh ? "选择模型…" : "Choose a model…") : zh ? "先选套餐" : "Plan first"
          }
          ariaLabel={zh ? "模型" : "Model"}
          disabled={!plan}
          emptyText={zh ? "无匹配" : "No matches"}
        />
      </label>
    </>
  );
}
