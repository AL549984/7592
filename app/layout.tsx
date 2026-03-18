import type { Metadata } from "next";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "A2A 大话骰子",
  description: "Second Me 黑客松参赛项目",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}