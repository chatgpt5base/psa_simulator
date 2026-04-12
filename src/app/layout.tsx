import type { Metadata } from "next";
import { GoogleAnalytics, GoogleTagManager } from "@next/third-parties/google";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

/** 環境変数があれば優先（未設定時はご指定の ID） */
const gaMeasurementId =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-Y9632M2PQ1";
const gtmId = process.env.NEXT_PUBLIC_GTM_ID ?? "GTM-WXGX5S5L";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PSA鑑定 利益シミュレーター",
  description:
    "PSA鑑定における仕入れ・鑑定費用・想定販売額から利益と返却目安を試算するツール",
  verification: {
    google: "isBQoi83VctvGPRLaQ7KvTlGcrZmHlKbOhEHabMWwNU",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
            height={0}
            width={0}
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
        {children}
        <GoogleTagManager gtmId={gtmId} />
        {/* GTM 内で同一 GA4 プロパティへ送っている場合は二重計測になるため、どちらか一方にしてください */}
        <GoogleAnalytics gaId={gaMeasurementId} />
      </body>
    </html>
  );
}
