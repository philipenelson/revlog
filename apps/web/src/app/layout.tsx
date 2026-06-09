import type { Metadata } from "next";
import { Outfit, DM_Sans, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { MediaStoreProvider } from "@/lib/media/MediaStoreProvider";
import { OpfsMediaStore } from "@/lib/media/OpfsMediaStore";
import "./globals.css";

// Instantiated once at module load time — SSR-safe because OpfsMediaStore
// guards every method with typeof window !== 'undefined'.
const mediaStore = new OpfsMediaStore();

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
          <MediaStoreProvider store={mediaStore}>{children}</MediaStoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
