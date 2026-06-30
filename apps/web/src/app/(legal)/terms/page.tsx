import type { Metadata } from "next";
import { TermsScreen } from "@/application/screens/legal/TermsScreen";

export const metadata: Metadata = {
  title: "Terms of Service – Revlog",
};

export default function TermsPage() {
  return <TermsScreen />;
}
