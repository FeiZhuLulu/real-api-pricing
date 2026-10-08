import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react";
import "./glass.css";

export interface GlassOption {
  value: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  disabled?: boolean;
}
export interface GlassGroup {
  label: string;
  icon?: ReactNode;
  /** Ungrouped lists use a single group with label "". */
  options: GlassOption[];
}

type PopoverDiv = HTMLDivElement & {
  showPopover?: () => void;
  hidePopover?: () => void;
};

interface Box {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

/** Fixed box under the anchor, flipping above when the space below is tight. */
function place(anchor: HTMLElement): Box {
  const r = anchor.getBoundingClientRect();
  const margin = 8;
  const width = Math.max(r.width, 240);
  const left = Math.min(
    Math.max(margin, r.left),
    Math.max(margin, window.innerWidth - width - margin),
  );
  const below = window.innerHeight - r.bottom - margin;
  const above = below < 260;
  const space = Math.max(96, above ? r.top - margin : below);
  const base = { left, width, maxHeight: Math.min(320, space) };
  return above
    ? { ...base, bottom: window.innerHeight - r.top + 4 }
    : { ...base, top: r.bottom + 4 };
}

/**
 * Anchored popup rendered as a top-layer popover (`popover="manual"`), so
 * overflow containers can never clip it. The element is portaled to the
 * nearest ancestor <dialog> when there is one — while a modal dialog is open
 * the rest of the document is inert, so the popup must live inside it to
 * receive pointer input — and to <body> otherwise. Either way the popup sits
 * outside any wrapping <label>, so option clicks cannot re-activate it.
 */
function Popup({
  open,
  anchor,
  popRef,
  children,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  popRef: RefObject<PopoverDiv | null>;
  children: ReactNode;
}) {
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const el = popRef.current;
    if (!open || !el || !anchor) return;
    el.setAttribute("popover", "manual");
    try {
      el.showPopover?.();
    } catch {
      /* Already showing, or no Popover support — fixed position still applies. */
    }
    const update = () => setBox(place(anchor));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      try {
        el.hidePopover?.();
      } catch {
        /* Closing an already-removed popover throws. */
      }
    };
  }, [open, anchor, popRef]);
  if (!open || !anchor) return null;
  return createPortal(
    <div
      ref={popRef}
      className="gs-pop"
      style={{
        left: box?.left,
        width: box?.width,
        maxHeight: box?.maxHeight,
        ...(box?.bottom !== undefined ? { bottom: box.bottom } : { top: box?.top }),
        visibility: box ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    anchor.closest("dialog") ?? document.body,
  );
}

/**
 * Dismiss an open popup on outside pointerdown, Tab or Esc. Esc is prevented
 * and stopped so a parent <dialog> never sees it — a dialog's cancel is this
 * keydown's default action. `refocus` is true only for Esc.
 */
function useDismiss(
  open: boolean,
  inside: (node: Node) => boolean,
  onDismiss: (refocus: boolean) => void,
) {
  const cb = useRef({ inside, onDismiss });
  cb.current = { inside, onDismiss };
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!cb.current.inside(e.target as Node)) cb.current.onDismiss(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cb.current.onDismiss(true);
      } else if (e.key === "Tab") {
        cb.current.onDismiss(false);
      }
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
}

/** Scrolls the active option into view whenever it changes. */
function useScrollActive(open: boolean, active: number, id: string) {
  useEffect(() => {
    if (open && active >= 0)
      document.getElementById(`${id}-o${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);
}

/** Enabled option `dir` steps from `active`, wrapping around; disabled skipped. */
function nextActive(options: GlassOption[], active: number, dir: number): number {
  if (!options.length) return -1;
  let i = active;
  for (let n = 0; n < options.length; n++) {
    i = (i + dir + options.length) % options.length;
    if (!options[i].disabled) return i;
  }
  return active;
}

function Option({
  option,
  index,
  id,
  active,
  selected,
  onActive,
  onPick,
}: {
  option: GlassOption;
  index: number;
  id: string;
  active: boolean;
  selected: boolean;
  onActive: (i: number) => void;
  onPick: (o: GlassOption) => void;
}) {
  return (
    <div
      id={`${id}-o${index}`}
      role="option"
      aria-selected={selected}
      aria-disabled={option.disabled || undefined}
      className={`gs-opt${active ? " is-active" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(option)}
      onMouseMove={() => {
        if (!active && !option.disabled) onActive(index);
      }}
    >
      {option.icon && <span className="gs-ic">{option.icon}</span>}
      <span className="gs-label">{option.label}</span>
      {selected && <Check className="gs-check" size={14} weight="bold" aria-hidden="true" />}
      {option.hint && <span className="gs-hint">{option.hint}</span>}
    </div>
  );
}

/**
 * Button-triggered single select. The trigger looks like the site's inputs;
 * the popup is a top-layer glass listbox with optional type-to-filter.
 */
export function GlassSelect({
  value,
  groups,
  onChange,
  placeholder,
  ariaLabel,
  disabled = false,
  searchable = false,
  searchPlaceholder,
  emptyText = "No matches",
  className,
}: {
  value: string;
  groups: GlassGroup[];
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<PopoverDiv>(null);
  const id = useId();

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? groups
            .map((g) => ({
              ...g,
              options: g.options.filter(
                (o) =>
                  o.label.toLowerCase().includes(q) ||
                  (o.hint ?? "").toLowerCase().includes(q) ||
                  g.label.toLowerCase().includes(q),
              ),
            }))
            .filter((g) => g.options.length > 0)
        : groups,
    [groups, q],
  );
  const visible = useMemo(() => filtered.flatMap((g) => g.options), [filtered]);
  const indexOf = useMemo(() => new Map(visible.map((o, i) => [o, i])), [visible]);
  const current = useMemo(
    () => groups.flatMap((g) => g.options).find((o) => o.value === value),
    [groups, value],
  );

  const openIt = () => {
    if (disabled) return;
    setQuery("");
    setOpen(true);
  };
  useDismiss(
    open,
    (n) => !!(rootRef.current?.contains(n) || popRef.current?.contains(n)),
    (refocus) => {
      setOpen(false);
      if (refocus) triggerRef.current?.focus();
    },
  );

  // A fresh (or re-filtered) list highlights the selection, else its first option.
  useEffect(() => {
    if (!open) return;
    const sel = q ? -1 : visible.findIndex((o) => o.value === value && !o.disabled);
    setActive(sel >= 0 ? sel : visible.findIndex((o) => !o.disabled));
  }, [open, visible, q, value]);
  useScrollActive(open, active, id);

  const pick = (o: GlassOption) => {
    if (o.disabled) return;
    onChange(o.value);
    setOpen(false);
    triggerRef.current?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openIt();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => nextActive(visible, a, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => nextActive(visible, a, -1));
        break;
      case "Home":
        e.preventDefault();
        setActive(visible.findIndex((o) => !o.disabled));
        break;
      case "End":
        e.preventDefault();
        for (let i = visible.length - 1; i >= 0; i--)
          if (!visible[i].disabled) {
            setActive(i);
            break;
          }
        break;
      case "Enter":
        if (active >= 0 && visible[active]) {
          e.preventDefault();
          pick(visible[active]);
        }
        break;
    }
  };

  return (
    <span className={`gs${className ? ` ${className}` : ""}`} ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={triggerRef}
        className={`gs-trigger${current ? "" : " is-empty"}`}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open && active >= 0 ? `${id}-o${active}` : undefined}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openIt())}
      >
        <span className="gs-value">
          {current?.icon}
          {current ? current.label : placeholder}
        </span>
        <CaretDown className="gs-chevron" size={14} aria-hidden="true" />
      </button>
      <Popup open={open} anchor={triggerRef.current} popRef={popRef}>
        {searchable && (
          <div className="gs-search">
            <MagnifyingGlass size={13} aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder ?? ariaLabel}
              aria-controls={`${id}-list`}
              aria-activedescendant={open && active >= 0 ? `${id}-o${active}` : undefined}
            />
          </div>
        )}
        <div className="gs-list" role="listbox" id={`${id}-list`} aria-label={ariaLabel}>
          {visible.length === 0 && <div className="gs-empty">{emptyText}</div>}
          {filtered.map((g, gi) => (
            <div
              key={g.label || gi}
              role={g.label ? "group" : undefined}
              aria-label={g.label || undefined}
            >
              {g.label !== "" && (
                <div className="gs-group" aria-hidden="true">
                  {g.icon}
                  {g.label}
                </div>
              )}
              {g.options.map((o) => (
                <Option
                  key={o.value}
                  option={o}
                  index={indexOf.get(o)!}
                  id={id}
                  active={indexOf.get(o) === active}
                  selected={o.value === value}
                  onActive={setActive}
                  onPick={pick}
                />
              ))}
            </div>
          ))}
        </div>
      </Popup>
    </span>
  );
}

/**
 * Free-text input with an optional glass list. Typing filters; the chevron
 * shows the full list. Text matching no option is kept as-is.
 */
export function GlassCombobox({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: GlassOption[];
  placeholder?: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLSpanElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<PopoverDiv>(null);
  const id = useId();

  const q = value.trim().toLowerCase();
  const shown = useMemo(
    () =>
      full || !q
        ? options
        : options.filter(
            (o) =>
              o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q),
          ),
    [options, full, q],
  );
  const indexOf = useMemo(() => new Map(shown.map((o, i) => [o, i])), [shown]);
  // Text that matches nothing keeps the list closed; the text itself stays.
  const listOpen = open && shown.length > 0;

  useDismiss(
    listOpen,
    (n) => !!(rootRef.current?.contains(n) || popRef.current?.contains(n)),
    (refocus) => {
      setOpen(false);
      setFull(false);
      if (refocus) inputRef.current?.focus();
    },
  );

  // The current value's exact match is highlighted first, else the top option.
  useEffect(() => {
    if (!listOpen) return;
    const sel = shown.findIndex((o) => o.value === value);
    setActive(sel >= 0 ? sel : 0);
  }, [listOpen, shown, value]);
  useScrollActive(listOpen, active, id);

  const pick = (o: GlassOption) => {
    if (o.disabled) return;
    onChange(o.value);
    setOpen(false);
    setFull(false);
    inputRef.current?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!listOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFull(true);
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => nextActive(shown, a, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => nextActive(shown, a, -1));
        break;
      case "Home":
        e.preventDefault();
        setActive(shown.findIndex((o) => !o.disabled));
        break;
      case "End":
        e.preventDefault();
        for (let i = shown.length - 1; i >= 0; i--)
          if (!shown[i].disabled) {
            setActive(i);
            break;
          }
        break;
      case "Enter":
        if (active >= 0 && shown[active]) {
          e.preventDefault();
          pick(shown[active]);
        }
        break;
    }
  };

  return (
    <span className="gs gs-combo" ref={rootRef} onKeyDown={onKeyDown}>
      <div className={`gs-field${listOpen ? " is-open" : ""}`} ref={fieldRef}>
        <input
          ref={inputRef}
          value={value}
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listOpen ? `${id}-list` : undefined}
          aria-activedescendant={listOpen && active >= 0 ? `${id}-o${active}` : undefined}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            onChange(e.target.value);
            setFull(false);
            setOpen(true);
          }}
        />
        <button
          type="button"
          className="gs-combo-btn"
          tabIndex={-1}
          aria-label={ariaLabel}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open && full) {
              setOpen(false);
              setFull(false);
            } else {
              setFull(true);
              setOpen(true);
            }
            inputRef.current?.focus();
          }}
        >
          <CaretDown className="gs-chevron" size={14} aria-hidden="true" />
        </button>
      </div>
      <Popup open={listOpen} anchor={fieldRef.current} popRef={popRef}>
        <div className="gs-list" role="listbox" id={`${id}-list`} aria-label={ariaLabel}>
          {shown.map((o) => (
            <Option
              key={o.value}
              option={o}
              index={indexOf.get(o)!}
              id={id}
              active={indexOf.get(o) === active}
              selected={o.value === value}
              onActive={setActive}
              onPick={pick}
            />
          ))}
        </div>
      </Popup>
    </span>
  );
}
