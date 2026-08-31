'use client';

import { SiteHeader } from '../../components/SiteHeader';
import WorkshopRegistrationForm from '../../components/WorkshopRegistrationForm';
import { GraphicsModeProvider } from '../../components/GraphicsMode';
import { redirect } from "next/navigation";

export default function Workshop1Page() {
  const registrationStartDate = new Date("2026-09-18T00:00:00+08:00");
  const currentDate = new Date();

  // Teleport the user to the main page if they are early
  if (currentDate < registrationStartDate) {
    redirect("/");
  }

  return (
    <GraphicsModeProvider>
      <main className="min-h-screen bg-[#030303]">
        <SiteHeader stage={"registration" as any} onNavigate={() => {}} />
        <div className="pt-24 pb-12 px-4 sm:px-6">
          <WorkshopRegistrationForm 
            workshopId="workshop1"
            title="AI Foundations & Hackathon Prep"
            description="Learn the fundamentals and tools needed to prepare for the AI hackathon."
            date="September 25, 2026"
            time="10:00 AM - 12:00 PM"
            venue="Lab A, Block C"
            speaker="[PENDING]"
          />
        </div>
      </main>
    </GraphicsModeProvider>
  );
}
