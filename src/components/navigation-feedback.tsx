"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PendingOverlay } from "@/components/pending-overlay";

function isPlainPrimaryClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function NavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const currentDestination = `${pathname}${search ? `?${search}` : ""}`;
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);
  const pending =
    pendingDestination !== null && pendingDestination !== currentDestination;

  useEffect(() => {
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const showPending = (destination: string) => {
      setPendingDestination(destination);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(() => setPendingDestination(null), 12_000);
    };

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || !isPlainPrimaryClick(event)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.hasAttribute("data-no-wait")
      ) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) return;

      showPending(`${destination.pathname}${destination.search}`);
    };

    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.method.toLowerCase() !== "get") return;

      const destination = new URL(form.action || window.location.href);
      const query = new URLSearchParams();
      for (const [key, value] of new FormData(form)) {
        if (typeof value === "string") query.append(key, value);
      }
      destination.search = query.toString();
      showPending(`${destination.pathname}${destination.search}`);
    };

    const handlePageShow = () => setPendingDestination(null);

    document.addEventListener("click", handleClick);
    document.addEventListener("submit", handleSubmit);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("submit", handleSubmit);
      window.removeEventListener("pageshow", handlePageShow);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, []);

  return <PendingOverlay visible={pending} message="請稍等，正在切換頁面…" />;
}
