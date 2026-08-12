import type { Metadata } from 'next';
import { HackathonLandingPage } from "../components/HackathonLandingPage";

export const metadata: Metadata = {
  title: 'AI Hackerdorm Sarawak',
  description: 'Join the AI Hackerdorm in Sarawak. The event is open for developers, creators, and AI enthusiasts !! There will be workshops as well as a chance to to win prizes, and meet new friends !! ',
};

export default function Page() {
  return <HackathonLandingPage />;
}