import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css"

const title = "AI HackerDorm Sarawak";
const description =
  "AI HackerDorm Sarawak is a 3-day AI hackathon by AI HackerDorm and the Swinburne Computer Science Club in Kuching, Borneo. Countdown, schedule, and event details.";

export const metadata: Metadata = {
  // Needed for Next to resolve the relative OG image URL below into an
  // absolute one. Currently the live Netlify URL — update this if a custom
  // domain is attached later.
  metadataBase: new URL("https://aihackadorm-n-build.netlify.app"),
  title,
  description,
  icons: {
    icon: [{ url: "/icon.jpeg", type: "image/jpeg" }],
    apple: [{ url: "/apple-icon.jpeg" }],
  },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: title,
    images: [{ url: "/AI-Hackadorm.png" }],
    locale: "en_US",
    type: "website",
  },
};


export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#030303] text-white antialiased">{children}</body>
    </html>
  );
}
