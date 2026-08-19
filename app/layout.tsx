import type { Metadata, Viewport } from "next";
import { Geist, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "TaskFlow",
  description: "Group + task management",
  appleWebApp: {
    capable: true,
    title: "TaskFlow",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#141318",
  // Tells modern browsers to actually resize the layout viewport (so 100dvh shrinks correctly)
  // when the on-screen keyboard opens, instead of just visually panning the page up over it —
  // that panning-without-resizing is what reads as "the keyboard pushes everything up".
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${spaceGrotesk.variable} ${plexMono.variable} h-full`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
