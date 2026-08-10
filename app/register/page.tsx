import type { Metadata } from 'next';
import RegistrationForm from '@/components/RegistrationForm';
import WaveBackground from '@/components/WaveBackground'; // Pulling in your team's wave dots!

// This fixes the typo in the browser tab at the top of the screen
export const metadata: Metadata = {
  title: 'Register | AI Hackerdorm Sarawak',
  description: 'Register for the AI Hackerdorm hackathon.',
};

export default function RegisterPage() {
  return (
    <main className="relative min-h-screen bg-[#030303] flex flex-col items-center justify-center p-6 pt-24 pb-12">
      
      {/* The Background Layer (z-0 keeps it in the back) */}
      <div className="absolute inset-0 z-0 opacity-60 pointer-events-none">
        <WaveBackground />
      </div>
      
      {/* The Form Layer (z-10 pulls it to the front so you can click it) */}
      <div className="relative z-10 w-full flex justify-center">
        <RegistrationForm />
      </div>

    </main>
  );
}