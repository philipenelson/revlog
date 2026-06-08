import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Revlog — Set up your garage",
};

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
