"use client";

import { useEffect } from "react";

/**
 * Scrolls to the element named in the URL's #hash once it exists. Put it next
 * to content that streams in after navigation (behind Suspense), which the
 * browser's own jump-to-anchor misses because the target isn't there yet.
 */
export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);
  return null;
}
