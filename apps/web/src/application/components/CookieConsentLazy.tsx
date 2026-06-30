"use client";

import dynamic from "next/dynamic";

export const CookieConsentLazy = dynamic(
  () => import("./CookieConsent").then((m) => m.CookieConsent),
  { ssr: false },
);
