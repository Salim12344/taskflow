import type { KeyboardEvent } from "react";

/** Lets a non-native clickable element (a styled `<div>`) respond to Enter/Space like a real button. */
export function onKeyActivate(handler: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handler();
    }
  };
}
