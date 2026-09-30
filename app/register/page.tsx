import { redirect } from 'next/navigation';
import { HACKATHON_REGISTRATION_URL } from '@/lib/countdown';

// Hackathon registration moved to the main AI HackerDorm event page. This
// route is kept only so old/shared /register links still land somewhere useful.
export default function RegisterPage() {
  redirect(HACKATHON_REGISTRATION_URL);
}
