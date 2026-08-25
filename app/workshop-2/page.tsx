'use client';

import { SiteHeader } from '../../components/SiteHeader';
import WorkshopRegistrationForm from '../../components/WorkshopRegistrationForm';
import { GraphicsModeProvider } from '../../components/GraphicsMode';
import { redirect } from "next/navigation";

export default function Workshop2Page() {
  // Teleport the user to the main page if they are early
  const registrationStartDate = new Date("2026-09-01T12:00:00+08:00");
  const currentDate = new Date();

  if (currentDate < registrationStartDate) {
    redirect("/");
  }

  return (
    <GraphicsModeProvider>
      <main className="min-h-screen bg-[#030303]">
        <SiteHeader stage={"registration" as any} onNavigate={() => {}} />
        <div className="pt-24 pb-12 px-4 sm:px-6">
          <WorkshopRegistrationForm 
            workshopId="workshop2"
            title="Prompt Engineering & LLM Applications"
            description="Build practical AI applications using modern large language model techniques."
            date="October 18, 2026"
            time="10:00 AM - 12:00 PM"
            venue="Lab B, Block C"
            speaker="[PENDING]"
          />
        </div>
      </main>
    </GraphicsModeProvider>
  );
}
