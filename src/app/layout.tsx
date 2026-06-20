import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lumière — Local Media Library",
  description:
    "A stunning, HiFi-grade media browser for movies, TV shows, music albums, and podcasts stored on your computer.",
  keywords: ["media", "library", "movies", "TV", "music", "podcasts", "HiFi"],
  authors: [{ name: "Lumière" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        {children}
        <Toaster />
        <SonnerToaster
          position="bottom-right"
          richColors
          toastOptions={{
            classNames: {
              toast: 'bg-card border-border text-foreground',
            },
          }}
        />
      </body>
    </html>
  );
}
