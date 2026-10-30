import { useId } from "react";
import type { ReactNode } from "react";

// Phase 1 public demo only (deleted in Phase 2, with lib/local/).
// Academy candidates are read-only, but their Edit, Add Note and Delete
// buttons stay visible, so visitors see what the app can do. Those buttons
// are disabled, and this explains why.

export const NO_PERMISSION = {
  edit: "You don't have permission to edit academy candidates. Only candidates you create can be edited.",
  addNote: "You don't have permission to add notes to academy candidates.",
  deleteNote: "You don't have permission to delete academy notes.",
};

// Base look for a locked button; each button keeps its own size and shape
export const LOCKED_BUTTON = "cursor-not-allowed opacity-50";

// Shows `message` while the button is hovered or focused (a tap focuses it
// on touch screens). The button uses aria-disabled, not disabled: a disabled
// button can't be focused, so keyboard and touch users would never see why.
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
  return (
    <span className="group/locked relative inline-flex shrink-0">
      {children(id)}
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute right-0 z-20 w-max max-w-64 rounded-lg bg-slate-900 px-3 py-2 text-left text-xs font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity group-focus-within/locked:opacity-100 group-hover/locked:opacity-100 ${
          placement === "above" ? "bottom-full mb-2" : "top-full mt-2"
        }`}
      >
        {message}
      </span>
    </span>
  );
}
