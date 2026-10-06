import type { Point } from "./types";
import { displayPlan, planKey, price } from "./domain";

export { planKey };
/** Model-select value that stands for every model of the chosen plan. */
export const ALL_MODELS = "*";

/** Plans offered by the pickers, grouped by channel for the <optgroup>s. */
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
 * Two dependent selects: a plan first, then one of its models. Nothing is
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
  const models = [...(options.plans.get(plan) ?? [])].sort((a, b) =>
    a.model_display.localeCompare(b.model_display),
  );
  return (
    <>
      <label>
        <span className="sr-only">{zh ? "套餐" : "Plan"}</span>
        <select value={plan} onChange={(e) => onPlan(e.target.value)}>
          <option value="" disabled>
            {zh ? "选择套餐…" : "Choose a plan…"}
          </option>
          {options.channelOrder.map((c) => (
            <optgroup key={c} label={c}>
              {options.channels.get(c)!.map((key) => {
                const p = options.plans.get(key)![0];
                return (
                  <option key={key} value={key}>
                    {`${displayPlan(p.plan, lang)} · ${price(p.price_usd)}${zh ? "/月" : "/mo"}`}
                  </option>
                );
              })}
            </optgroup>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">{zh ? "模型" : "Model"}</span>
        <select value={model} disabled={!plan} onChange={(e) => onModel(e.target.value)}>
          <option value="" disabled>
            {plan ? (zh ? "选择模型…" : "Choose a model…") : zh ? "先选套餐" : "Plan first"}
          </option>
          {allowAll && models.length > 1 && (
            <option value={ALL_MODELS}>
              {zh ? `该套餐全部模型（${models.length}）` : `All models in this plan (${models.length})`}
            </option>
          )}
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.model_display}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
