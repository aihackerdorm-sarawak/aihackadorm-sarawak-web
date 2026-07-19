import type { Metadata } from "next";
import type { ReactNode } from "react";
import WaveBackground, { type AmbientRippleConfig } from "@/components/WaveBackground";
import "./globals.css"

export const metadata: Metadata = {
  title: "AI Hackadorm Sarawak",
  description:
    "A partner-first hackathon landing page built for universities, organizations, and community outreach in Sarawak.",
};

const ambientConfig: AmbientRippleConfig = {
  maxRadius: 320,
  force: 9,
  intervalMin: 3000,
  intervalMax: 7000,
  countPerBurst: 2,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <WaveBackground
          dotColor="rgba(0, 240, 255, 0.28)"
          ambient={ambientConfig}
        />
        {children}
      </body>
    </html>
  );
}
