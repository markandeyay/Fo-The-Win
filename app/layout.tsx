import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ftw-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ftw-serif",
});

export const metadata: Metadata = {
  title: "Fo The Win",
  description: "Real-time competitive math practice",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${newsreader.variable} antialiased bg-ftw-bg text-ftw-text`}>
        {children}
      </body>
    </html>
  );
}
