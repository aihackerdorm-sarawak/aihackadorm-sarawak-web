import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css"

export const metadata: Metadata = {
  title: "AI HackerDorm Sarawak",
  description:
    "A monochrome hackathon landing page for AI HackerDorm and Swinburne Sarawak.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#030303] text-white antialiased">{children}</body>
    </html>
  );
}
