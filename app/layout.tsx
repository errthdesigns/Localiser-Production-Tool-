import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Production Localiser - Henkel × Accenture Song",
  description: "Video localization tool for multi-market production",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
