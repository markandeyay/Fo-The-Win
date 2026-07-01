import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased bg-ftw-dark text-ftw-text">
        {children}
      </body>
    </html>
  );
}
