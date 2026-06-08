import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Revlog — Garage",
};

export default function GarageLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
