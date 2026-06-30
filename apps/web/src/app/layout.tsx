import type { Metadata } from "next";
import { Outfit, DM_Sans, Geist_Mono } from "next/font/google";
import dynamic from "next/dynamic";
import { AuthProvider } from "@/application/providers/AuthProvider";
import { MediaStoreProvider } from "@/infrastructure/media/MediaStoreProvider";
import "./globals.css";

const CookieConsent = dynamic(
  () => import("@/application/components/CookieConsent").then((m) => m.CookieConsent),
  { ssr: false },
);

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  axes: ["opsz"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Revlog",
  description: "Your service history, your ownership record.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${dmSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <MediaStoreProvider>{children}</MediaStoreProvider>
        </AuthProvider>
        <CookieConsent />
      </body>
    </html>
  );
}
