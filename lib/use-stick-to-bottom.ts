"use client";

import { useEffect, useRef } from "react";

/** Auto-scrolls a chat to the newest message only if the user was already near the bottom — polling shouldn't yank someone back down while they're reading older messages. */
export function useStickToBottom<T>(items: T[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  function onScroll() {
    const el = containerRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }

  useEffect(() => {
    if (isNearBottomRef.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [items]);

  return { containerRef, endRef, onScroll };
}
