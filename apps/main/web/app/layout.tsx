import type { Metadata, Viewport } from "next";
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

// manifest 링크는 app/manifest.ts 파일 컨벤션으로 Next.js가 자동 주입 — 여기서 중복 지정하지 않음.
export const metadata: Metadata = {
  title: "payLens",
  description: "Trusted Expense Analysis",
  appleWebApp: {
    title: "payLens",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B2545",
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
