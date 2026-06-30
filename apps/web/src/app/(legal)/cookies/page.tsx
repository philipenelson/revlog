import type { Metadata } from "next";
import { CookiesScreen } from "@/application/screens/legal/CookiesScreen";

export const metadata: Metadata = {
  title: "Cookie Policy – Revlog",
};

export default function CookiesPage() {
  return <CookiesScreen />;
}
