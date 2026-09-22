import { useRef } from "react";

const MIN = 240;

export default function ResizeHandle({
  target,
  label,
}: {
  target: React.RefObject<HTMLElement | null>;
  label: string;
}) {
  const drag = useRef<{ y: number; h: number; max: number } | null>(null);
  const cap = (el: HTMLElement) =>
    Math.max(
      el.getBoundingClientRect().height,
      el.scrollHeight + (el.offsetHeight - el.clientHeight),
    );
  const setH = (h: number, max: number) => {
    const el = target.current;
    if (!el) return;
    el.style.maxHeight = "none";
    el.style.height = `${Math.min(Math.max(h, MIN), max)}px`;
  };
  const reset = () => {
    const el = target.current;
    if (!el) return;
    el.style.height = "";
    el.style.maxHeight = "";
  };
  return (
    <div
      className="resize-handle"
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      title={label}
      tabIndex={0}
      onPointerDown={(e) => {
        const el = target.current;
        if (!el) return;
        drag.current = {
          y: e.clientY,
          h: el.getBoundingClientRect().height,
          max: cap(el),
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d) setH(d.h + e.clientY - d.y, d.max);
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={reset}
      onKeyDown={(e) => {
        const el = target.current;
        if (!el) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          setH(
            el.getBoundingClientRect().height + (e.key === "ArrowDown" ? 48 : -48),
            cap(el),
          );
          e.preventDefault();
        } else if (e.key === "Enter") {
          reset();
          e.preventDefault();
        }
      }}
    >
      <span />
    </div>
  );
}
