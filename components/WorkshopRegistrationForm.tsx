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
  const [captchaError, setCaptchaError] = useState(false);

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
      {(isSubmitting || submissionStatus.type !== 'idle') && createPortal(
        <div
          role={submissionStatus.type === 'error' ? 'alert' : 'status'}
          aria-live={submissionStatus.type === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
          className="fixed inset-x-4 top-5 z-[100] flex justify-center pointer-events-none sm:top-7"
        >
          <div
            className={`pointer-events-auto flex w-full max-w-md items-center gap-3 overflow-hidden rounded-xl border bg-zinc-950/95 px-4 py-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-300 ${
              isSubmitting
                ? 'border-cyan-400/50 shadow-cyan-500/20'
                : submissionStatus.type === 'success'
                  ? 'border-emerald-400/50 shadow-emerald-500/20'
                  : 'border-red-400/50 shadow-red-500/20'
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                isSubmitting
                  ? 'bg-cyan-400/10 text-cyan-300'
                  : submissionStatus.type === 'success'
                    ? 'bg-emerald-400/10 text-emerald-300'
                    : 'bg-red-400/10 text-red-300'
              }`}
              aria-hidden="true"
            >
              {isSubmitting ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : submissionStatus.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold tracking-wide text-white">
                {isSubmitting
                  ? 'Submitting registration'
                  : submissionStatus.type === 'success'
                    ? 'Registration received'
                    : 'Submission unsuccessful'}
              </p>
              <p className="mt-0.5 text-sm leading-5 text-zinc-300">
                {isSubmitting ? 'Please wait while we secure your spot...' : submissionStatus.message}
              </p>
            </div>

            {!isSubmitting && (
              <button
                type="button"
                onClick={() => setSubmissionStatus({ type: 'idle', message: '' })}
                className="shrink-0 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
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

          <div className="flex flex-col items-center justify-center my-4 min-h-[85px]">
            <Turnstile 
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''} 
              onSuccess={(token) => {
                setTurnstileToken(token);
                setCaptchaError(false);
              }} 
              onError={() => {
                setTurnstileToken(null);
                setCaptchaError(true);
              }}
              onExpire={() => {
                setTurnstileToken(null);
                setCaptchaError(true);
              }}
            />
            {/* Show the error message if verification fails */}
            {captchaError && (
              <p className="text-red-400 text-sm mt-2 font-bold animate-in fade-in">
                Verification Unsuccessful
              </p>
            )}
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
            {!turnstileToken 
              ? (captchaError ? 'VERIFICATION UNSUCCESSFUL' : 'PLEASE WAIT FOR VERIFICATION') 
              : 'SUBMIT REGISTRATION →'}
          </button>
      </form>
    </div>
  );
}
