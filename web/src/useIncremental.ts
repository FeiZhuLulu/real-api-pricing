import { useEffect, useRef, useState } from "react";

/**
 * Render long lists in chunks: the first `step` rows immediately, more as a
 * sentinel near the end of the scroll container comes into view. Keeps
 * keystrokes and filter changes cheap when the table holds 1,000+ rows,
 * while every row stays reachable by scrolling (and exports use all rows).
 */
export function useIncremental(
  total: number,
  resetKey: string,
  root: React.RefObject<HTMLElement | null>,
  step = 80,
) {
  const [limit, setLimit] = useState(step);
  const sentinel = useRef<HTMLElement | null>(null);
  useEffect(() => setLimit(step), [resetKey, step]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || limit >= total) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting))
          setLimit((n) => Math.min(total, n + step));
      },
      { root: root.current, rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [limit, total, step, root, resetKey]);
  return { limit: Math.min(limit, total), sentinel };
}
