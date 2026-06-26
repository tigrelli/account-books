import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "@fontsource/pretendard/400.css";
import "@fontsource/pretendard/500.css";
import "@fontsource/pretendard/700.css";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "payLens",
  description: "Trusted Expense Analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={jetbrainsMono.variable}>
      <body>{children}</body>
    </html>
  );
}
