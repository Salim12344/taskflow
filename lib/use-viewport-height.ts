"use client";

import { useEffect, useState } from "react";

/**
 * iOS Safari's keyboard toolbar (prev/next/done) sits above the keyboard but isn't always
 * reflected precisely by CSS `dvh` in time — tracking window.visualViewport directly is the
 * reliable way to keep fixed-bottom UI (like a chat composer) from ending up hidden behind it.
 */
export function useViewportHeight() {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function update() {
      setHeight(vv!.height);
    }
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return height;
}
