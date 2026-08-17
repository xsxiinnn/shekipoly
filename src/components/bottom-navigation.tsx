"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavigationItem = {
  href: "/report" | "/map" | "/rules";
  label: string;
  icon: ReactNode;
};

const iconClassName = "size-6";

const navigationItems: NavigationItem[] = [
  {
    href: "/report",
    label: "回報",
    icon: (
      <svg
        aria-hidden="true"
        className={iconClassName}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"
        />
      </svg>
    ),
  },
  {
    href: "/map",
    label: "地圖",
    icon: (
      <svg
        aria-hidden="true"
        className={iconClassName}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m3.5 6.5 5-2.5 7 2.5 5-2.5v13.5l-5 2.5-7-2.5-5 2.5V6.5Z"
        />
        <path strokeLinecap="round" d="M8.5 4v13.5m7-11V20" />
      </svg>
    ),
  },
  {
    href: "/rules",
    label: "規則",
    icon: (
      <svg
        aria-hidden="true"
        className={iconClassName}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 3.5h9.5L19 7v13.5H6V3.5Z"
        />
        <path strokeLinecap="round" d="M15 3.5V7h4M9 11h7m-7 4h7" />
      </svg>
    ),
  },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="學生功能"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md border-t border-border bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(29,39,36,0.06)] backdrop-blur"
    >
      <ul className="grid grid-cols-3">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className="relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-xs font-semibold"
              >
                {isActive ? (
                  <motion.span
                    layoutId="active-navigation-item"
                    className="absolute inset-x-2 inset-y-0 rounded-2xl bg-brand-soft"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <motion.span
                  className={`relative ${isActive ? "text-brand" : "text-muted"}`}
                  animate={{ y: isActive ? -1 : 0 }}
                >
                  {item.icon}
                </motion.span>
                <span
                  className={`relative ${isActive ? "text-brand" : "text-muted"}`}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
