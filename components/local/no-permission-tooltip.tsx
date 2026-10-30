"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

import { SUCCESS_MESSAGE_MS } from "@/lib/constants";

// Phase 1 public demo only (deleted in Phase 2, with lib/local/).
// Academy candidates are read-only, but their Edit, Add Note and Delete
// buttons stay visible, so visitors see what the app can do. Those buttons
// are disabled, and this explains why.

export const NO_PERMISSION = {
  edit: "You can only edit candidates you created.",
  addNote: "You can only add notes to candidates you created.",
  deleteNote: "You can only delete notes on candidates you created.",
};

// Base look for a locked button; each button keeps its own size and shape
export const LOCKED_BUTTON = "cursor-not-allowed opacity-50";

// Shows `message` while the button is hovered or focused, or for a few
// seconds after a tap. Taps need their own state: phones can't hover
// (Tailwind's hover: needs a hover-capable device) and Safari doesn't focus
// a tapped button. The button uses aria-disabled, not disabled: a disabled
// button can't be focused, so keyboard users would never see why.
// children gets the tooltip's id for the button's aria-describedby.
export default function NoPermissionTooltip({
  message,
  placement = "below",
  children,
}: {
  message: string;
  placement?: "above" | "below";
  children: (tooltipId: string) => ReactNode;
}) {
  const id = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const [tapped, setTapped] = useState(false);

  // Hide a tapped tooltip after a few seconds, or on a tap anywhere else
  useEffect(() => {
    if (!tapped) return;
    const timer = setTimeout(() => setTapped(false), SUCCESS_MESSAGE_MS);
    const closeOnTapOutside = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setTapped(false);
    };
    document.addEventListener("pointerdown", closeOnTapOutside);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", closeOnTapOutside);
    };
  }, [tapped]);

  return (
    <span
      ref={wrapperRef}
      // Mouse users already get hover; this is for touch and pen
      onPointerUp={(event) => {
        if (event.pointerType !== "mouse") setTapped(true);
      }}
      className="group/locked relative inline-flex shrink-0"
    >
      {children(id)}
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute right-0 z-20 w-max max-w-64 rounded-lg bg-slate-900 px-3 py-2 text-left text-xs font-medium leading-snug text-white shadow-lg transition-opacity group-focus-within/locked:opacity-100 group-hover/locked:opacity-100 ${
          tapped ? "opacity-100" : "opacity-0"
        } ${placement === "above" ? "bottom-full mb-2" : "top-full mt-2"}`}
      >
        {message}
      </span>
    </span>
  );
}
