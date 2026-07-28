import type { Metadata } from 'next';
import { HackathonLandingPage } from "../components/HackathonLandingPage";

export const metadata: Metadata = {
  title: 'AI Hackadorm Sarawak | Coliving & Hackathon Space',
  description: 'Join the AI Hackadorm in Sarawak. A dedicated coliving space and hackathon hub for developers, creators, and AI enthusiasts in Kuching.',
};

export default function Page() {
  return <HackathonLandingPage />;
}