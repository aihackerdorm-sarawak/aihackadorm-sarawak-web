'use client'

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { get, useForm, type FieldPath, type UseFormReturn } from 'react-hook-form';
import { Turnstile } from '@marsidev/react-turnstile';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, LoaderCircle, X } from 'lucide-react';
import Link from 'next/link';
import * as z from 'zod';

// We added Props so the page can tell the form WHICH workshop it is for
interface WorkshopFormProps {
  workshopId: string;
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  speaker: string;
}

const phoneRegex = /^\+?[0-9\s\-()]{8,20}$/;

const workshopSchema = z.object({
  fullName: z.string().min(2, 'Name is required'),
  email: z.string().email('Please enter a valid email address'),
  whatsapp: z.string().regex(phoneRegex, 'Invalid WhatsApp format (e.g., +60 12-345-6789)'),
  university: z.string().min(2, 'University is required'),
  hearAboutUs: z.string().min(2, 'Please tell us how you found us'),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: "You must accept the Terms and Conditions.",
  }),
});
  
type WorkshopData = z.infer<typeof workshopSchema>;

type FormField = {
  id: keyof WorkshopData;
  label: string;
  type: string;
  placeholder?: string;
};

const workshopFields: FormField[] = [
  { id: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Ada Lovelace' },
  { id: 'email', label: 'Email Address', type: 'email', placeholder: 'ada@example.com' },
  { id: 'whatsapp', label: 'WhatsApp Friendly Number', type: 'tel', placeholder: '+60 12-345-6789' },
  { id: 'university', label: 'University / Institution', type: 'text', placeholder: 'Swinburne University' },
  { id: 'hearAboutUs', label: 'How did you hear about us?', type: 'text', placeholder: 'Instagram, Friend, etc.' },
];

export default function WorkshopRegistrationForm({ workshopId, title, description, date, time, venue, speaker }: WorkshopFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState({ type: 'idle', message: '' });

  useEffect(() => {
    if (submissionStatus.type === 'idle') return;
    const timeout = window.setTimeout(() => setSubmissionStatus({ type: 'idle', message: '' }), 6000);
    return () => window.clearTimeout(timeout);
  }, [submissionStatus]);

  const workshopForm = useForm<WorkshopData>({
    resolver: zodResolver(workshopSchema),
    mode: 'onChange',
    defaultValues: { acceptTerms: false },
  });

  const submitRegistration = async (payload: object) => {
    setIsSubmitting(true);
    setSubmissionStatus({ type: 'idle', message: '' });
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.message || 'Error submitting.');
      setSubmissionStatus({ type: 'success', message: result.message || 'Success!' });
      workshopForm.reset();
    } catch (error) {
      setSubmissionStatus({ type: 'error', message: error instanceof Error ? error.message : 'Error.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onWorkshopSubmit = async (data: WorkshopData) => {
    await submitRegistration({
      formType: 'workshop',
      turnstileToken: turnstileToken, 
      data: {
        name: data.fullName,          // Sneaks fullName into the 'name' column
        email: data.email,
        whatsapp: data.whatsapp,
        university: data.university,
        program: data.hearAboutUs,    // Sneaks 'hearAboutUs' into the 'program' column
        yearOfStudy: workshopId,      // Sneaks the workshop name into 'yearOfStudy'
      },
    });
  };

  const renderInput = (field: FormField, form: UseFormReturn<WorkshopData>) => {
    const fieldName = field.id as FieldPath<WorkshopData>;
    const error = get(form.formState.errors, fieldName);
    const inputClasses = `p-3 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-white/10 text-white placeholder:text-white/30 hover:border-cyan-400/40 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 focus:outline-none transition-all duration-300`;

    return (
      <div key={fieldName} className="flex flex-col">
        <label className="mb-1.5 text-sm text-white/70">{field.label}</label>
        <input type={field.type} placeholder={field.placeholder} {...form.register(fieldName)} className={inputClasses} />
        {error && <span className="text-red-400 text-xs mt-1">{error.message as string}</span>}
      </div>
    );
  };

  return (
    <div className="p-6 sm:p-8 bg-white/[0.045] backdrop-blur-md border border-white/10 rounded-[30px] max-w-3xl w-full mx-auto text-white shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <Link href="/" className="inline-block mb-6 text-sm font-semibold text-white/50 hover:text-cyan-400 transition-colors">← Back to Home</Link>
      
      <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-[-0.06em] mb-4 text-center text-white">Workshop Registration</h2>
      
      {/* NEW SECTION: Workshop Info injected directly under the title */}
      <div className="mb-8 rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-6 text-center">
        <h3 className="mb-2 text-xl font-bold text-cyan-400">{title}</h3>
        <p className="mb-4 text-sm text-zinc-300">{description}</p>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs uppercase tracking-wide text-zinc-400">
          <p><span className="text-zinc-500 mr-2">Date:</span>{date}</p>
          <p><span className="text-zinc-500 mr-2">Time:</span>{time}</p>
          <p><span className="text-zinc-500 mr-2">Venue:</span>{venue}</p>
          <p><span className="text-zinc-500 mr-2">Speaker:</span>{speaker}</p>
        </div>
      </div>

      <form onSubmit={workshopForm.handleSubmit(onWorkshopSubmit)} className="space-y-8 animate-in fade-in duration-300">
          <div className="space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.42em] text-cyan-400/60 border-b border-white/10 pb-2">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {workshopFields.map(field => renderInput(field, workshopForm))}
            </div>
          </div>

          <div className="flex justify-center my-4 min-h-[65px]">
            <Turnstile 
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''} 
              onSuccess={(token) => setTurnstileToken(token)} 
            />
          </div>

          <div className="space-y-3 border-t border-white/10 pt-6">
            <div className="flex items-start gap-3 text-sm leading-6 text-zinc-300">
              <input id="acceptTerms" type="checkbox" {...workshopForm.register('acceptTerms')} className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-cyan-400" />
              <span>
                <label htmlFor="acceptTerms" className="cursor-pointer">I have read and agree to the </label>
                <button type="button" onClick={() => setIsTermsOpen(true)} className="font-semibold text-cyan-300 underline decoration-cyan-400/50 underline-offset-4 hover:text-cyan-200">Terms &amp; Conditions</button>.
              </span>
            </div>
            {workshopForm.formState.errors.acceptTerms && <p className="text-xs text-red-400">{workshopForm.formState.errors.acceptTerms.message}</p>}
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting || !turnstileToken} 
            className="w-full bg-white text-black font-bold py-3 px-4 rounded-full hover:bg-cyan-400 transition-colors mt-6 text-base sm:py-4 sm:text-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {!turnstileToken ? 'PLEASE WAIT FOR VERIFICATION' : 'SUBMIT REGISTRATION →'}
          </button>
      </form>
      {/* --- SUCCESS POPUP MODAL --- */}
      {submissionStatus.type === 'success' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-zinc-900 border border-cyan-400/50 p-8 rounded-[30px] max-w-sm w-full text-center shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <CheckCircle2 className="w-24 h-24 text-cyan-400 mx-auto mb-6" />
            <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-wide">
              Success!
            </h3>
            <p className="text-zinc-400 mb-8 leading-relaxed">
              {submissionStatus.message || "Your registration has been successfully recorded. We will see you there!"}
            </p>
            <button 
              onClick={() => window.location.href = '/'} 
              className="w-full bg-cyan-400 text-black font-bold py-3 px-4 rounded-full hover:bg-white transition-colors mt-2"
            >
              BACK TO HOME
            </button>
          </div>
        </div>
      )}
      {/* --- END SUCCESS POPUP MODAL --- */}

    </div>
  );
}