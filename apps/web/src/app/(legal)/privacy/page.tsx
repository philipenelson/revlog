import type { Metadata } from "next";
import { PrivacyScreen } from "@/application/screens/legal/PrivacyScreen";

export const metadata: Metadata = {
  title: "Privacy Policy – Revlog",
};

export default function PrivacyPage() {
  return <PrivacyScreen />;
}
