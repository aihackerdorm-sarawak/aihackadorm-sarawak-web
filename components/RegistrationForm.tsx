'use client'

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Turnstile } from '@marsidev/react-turnstile';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import * as z from 'zod';

// ==========================================
// 1. SCHEMAS (The Rules)
// ==========================================

// A reusable regex pattern for phone numbers
// Allows optional +, numbers, spaces, dashes, and parentheses between 8 and 20 characters
const phoneRegex = /^\+?[0-9\s\-()]{8,20}$/;

const workshopSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Please enter a valid email address'),
  whatsapp: z.string().regex(phoneRegex, 'Invalid WhatsApp format (e.g., +60 12-345-6789)'),
  university: z.string().min(2, 'University is required'),
  program: z.string().min(2, 'Program/Course is required'),
  yearOfStudy: z.string().min(1, 'Year of study is required'),
});
type WorkshopData = z.infer<typeof workshopSchema>;

const hackathonSchema = z.object({
  teamName: z.string().min(2, 'Team name is required'),
  teamUniversity: z.string().min(2, 'University is required'),
  teamSize: z.preprocess((val) => Number(val), z.number().min(1).max(5)),
  hearAboutUs: z.string().min(2, 'Please tell us how you found us'),
  leaderName: z.string().min(2, 'Leader name is required'),
  leaderEmail: z.string().email('Please enter a valid email address'),
  leaderWhatsapp: z.string().regex(phoneRegex, 'Invalid WhatsApp format (e.g., +60 12-345-6789)'),
  leaderUniversity: z.string().min(2, 'University is required'),
  leaderProgram: z.string().min(2, 'Program/Course is required'),
  leaderYear: z.string().min(1, 'Year of study is required'),
  
  // 1. We replace z.any() with a strict object matching the member fields!
  members: z.array(
    z.object({
      fullName: z.string().min(2, 'Name is required'),
      email: z.string().email('Please enter a valid email address'),
      contact: z.string().regex(phoneRegex, 'Invalid WhatsApp format (e.g., +60 12-345-6789)'),
      studentId: z.string().min(2, 'Student ID is required'),
      university: z.string().min(2, 'University is required'),
      program: z.string().min(2, 'Program/Course is required'),
      year: z.string().min(1, 'Year of study is required'),
    })
  ).optional(), 
});
type HackathonData = z.infer<typeof hackathonSchema>;

type SubmissionStatus =
  | { type: 'idle'; message: '' }
  | { type: 'success' | 'error'; message: string };

type RegistrationResponse = {
  success: boolean;
  message?: string;
};

// ==========================================
// 2. FORM CONFIGURATIONS (The Data)
// If you need a new field, just add it to these arrays!
// ==========================================
// 1. Ensure this list exists right above the fields
const yearOptions = ['Foundation', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Postgraduate'];

const workshopFields = [
  { id: 'name', label: 'Full Name', type: 'text', placeholder: 'Ada Lovelace' },
  { id: 'email', label: 'Email Address', type: 'email', placeholder: 'ada@example.com' },
  { id: 'whatsapp', label: 'WhatsApp Friendly Number', type: 'tel', placeholder: '+60 12-345-6789' },
  { id: 'university', label: 'University', type: 'text', placeholder: 'Swinburne University' },
  { id: 'program', label: 'Program / Course', type: 'text', placeholder: 'Computer Science' },
  // Changed from text to select
  { id: 'yearOfStudy', label: 'Year of Study', type: 'select', options: yearOptions }, 
];

const hackathonTeamFields = [
  { id: 'teamName', label: 'Team Name', type: 'text', placeholder: 'e.g. The Innovators' },
  { id: 'teamUniversity', label: 'University / Institution', type: 'text', placeholder: 'Swinburne University' },
  { id: 'hearAboutUs', label: 'How did you hear about us?', type: 'text', placeholder: 'Instagram, Friend, etc.' },
];

const hackathonLeaderFields = [
  { id: 'leaderName', label: 'Full Name', type: 'text', placeholder: 'Ada Lovelace' },
  { id: 'leaderEmail', label: 'Email Address', type: 'email', placeholder: 'ada@example.com' },
  { id: 'leaderWhatsapp', label: 'WhatsApp Friendly Number', type: 'tel', placeholder: '+60 12-345-6789' },
  { id: 'leaderUniversity', label: 'University', type: 'text', placeholder: 'Swinburne University' },
  { id: 'leaderProgram', label: 'Programme / Course', type: 'text', placeholder: 'Computer Science' },
  // Changed from text to select
  { id: 'leaderYear', label: 'Year of Study', type: 'select', options: yearOptions },
];

const memberFields = [
  { id: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Alan Turing' },
  { id: 'email', label: 'Email Address', type: 'email', placeholder: 'alan@example.com' },
  { id: 'contact', label: 'Contact Number', type: 'tel', placeholder: '+60 12-987-6543' },
  { id: 'studentId', label: 'Student ID', type: 'text', placeholder: '101234567' },
  { id: 'university', label: 'University', type: 'text', placeholder: 'Swinburne University' },
  { id: 'program', label: 'Programme / Course', type: 'text', placeholder: 'Software Engineering' },
  // Changed from text to select
  { id: 'year', label: 'Year of Study', type: 'select', options: yearOptions },
];

// ==========================================
// 3. MAIN COMPONENT
// ==========================================
export default function RegistrationForm() {
  const [formType, setFormType] = useState<'hackathon' | 'workshop'>('hackathon');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({ type: 'idle', message: '' });
  const submissionInProgress = React.useRef(false);

  const hackathonForm = useForm<HackathonData>({ resolver: zodResolver(hackathonSchema) as any, mode: 'onChange' });
  const workshopForm = useForm<WorkshopData>({ resolver: zodResolver(workshopSchema) as any, mode: 'onChange' });
  
  const currentTeamSize = hackathonForm.watch('teamSize');

  const submitRegistration = async (payload: object) => {
    if (submissionInProgress.current) return;

    submissionInProgress.current = true;
    setIsSubmitting(true);
    setSubmissionStatus({ type: 'idle', message: '' });

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null) as RegistrationResponse | null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Unable to submit your registration. Please try again.');
      }

      setSubmissionStatus({
        type: 'success',
        message: result.message || 'Registration submitted successfully.',
      });
    } catch (error) {
      setSubmissionStatus({
        type: 'error',
        message: error instanceof Error
          ? error.message
          : 'Unable to submit your registration. Please try again.',
      });
    } finally {
      submissionInProgress.current = false;
      setIsSubmitting(false);
    }
  };

  const onHackathonSubmit = async (data: HackathonData) => {
    const teamMembers = (data.members ?? []).slice(0, data.teamSize - 1).map((member) => ({
      fullName: member.fullName,
      email: member.email,
      contact: member.contact,
      studentId: member.studentId,
      university: member.university,
      program: member.program,
      yearOfStudy: member.year,
    }));

    await submitRegistration({
      formType: 'hackathon',
      data: {
        teamName: data.teamName,
        teamUniversity: data.teamUniversity,
        teamSize: data.teamSize,
        howDidYouHear: data.hearAboutUs,
        teamLeader: {
          fullName: data.leaderName,
          email: data.leaderEmail,
          contact: data.leaderWhatsapp,
          university: data.leaderUniversity,
          program: data.leaderProgram,
          yearOfStudy: data.leaderYear,
        },
        teamMembers,
      },
    });
  };

  const onWorkshopSubmit = async (data: WorkshopData) => {
    await submitRegistration({ formType: 'workshop', data });
  };

  // Helper component to render inputs OR dropdowns beautifully
  const renderInput = (field: any, form: any, prefix = '') => {
    const fieldName = prefix ? `${prefix}.${field.id}` : field.id;
    const error = prefix 
      ? form.formState.errors.members?.[parseInt(prefix.split('.')[1])]?.[field.id]
      : form.formState.errors[field.id];

    // THE MAGIC: These classes create the hover and focus animations!
    const inputClasses = `
      p-3 rounded-lg bg-zinc-900 border border-zinc-800 
      hover:border-cyan-500/60 hover:shadow-[0_0_10px_rgba(6,182,212,0.2)]
      focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 focus:shadow-[0_0_15px_rgba(6,182,212,0.4)]
      focus:outline-none transition-all duration-300
    `;

    return (
      <div key={fieldName} className="flex flex-col">
        <label className="mb-1.5 text-sm text-zinc-300">{field.label}</label>
        
        {field.type === 'select' ? (
          <select 
            {...form.register(fieldName)}
            defaultValue=""
            className={`${inputClasses} appearance-none`}
          >
            <option value="" disabled>Select year...</option>
            {field.options.map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input 
            type={field.type}
            placeholder={field.placeholder}
            {...form.register(fieldName)} 
            className={inputClasses} 
          />
        )}
        
        {error && <span className="text-red-400 text-xs mt-1">{error.message as string}</span>}
      </div>
    );
  };

  return (
    <div className="p-8 bg-zinc-950/80 backdrop-blur-md border border-zinc-800 rounded-2xl max-w-3xl w-full mx-auto text-white shadow-xl">
      <Link 
        href="/" 
        className="inline-block mb-6 text-sm font-semibold text-zinc-400 hover:text-cyan-400 transition-colors"
      >
        ← Back to Home
      </Link>
      <h2 className="text-3xl font-bold mb-6 tracking-tight text-center">Registration</h2>
      
      {/* TAB SWITCHER */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8 bg-black p-2 rounded-xl border border-zinc-800">
        <button type="button" disabled={isSubmitting} onClick={() => { setFormType('hackathon'); setSubmissionStatus({ type: 'idle', message: '' }); }} className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${formType === 'hackathon' ? 'bg-cyan-500 text-black' : 'text-zinc-400 hover:text-white'}`}>
          Hackathon Participation
        </button>
        <button type="button" disabled={isSubmitting} onClick={() => { setFormType('workshop'); setSubmissionStatus({ type: 'idle', message: '' }); }} className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${formType === 'workshop' ? 'bg-cyan-500 text-black' : 'text-zinc-400 hover:text-white'}`}>
          Workshop Participation
        </button>
      </div>

      {/* --- THE NEW ANIMATED WRAPPER --- */}
      {/* The key={formType} forces React to replay the animation every time the tab changes */}
      <div key={formType} className="animate-slide-fade"></div>

      {/* HACKATHON FORM */}
      {formType === 'hackathon' && (
        <form onSubmit={hackathonForm.handleSubmit(onHackathonSubmit)} className="space-y-8 animate-in fade-in duration-300">
          
          <div className="space-y-4">
            <h3 className="text-xl font-bold border-b border-zinc-800 pb-2 text-cyan-400">Team Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Render regular team fields via mapping */}
              {hackathonTeamFields.map(field => renderInput(field, hackathonForm))}
              
              {/* Dropdown needs manual handling because it's a select, not an input */}
              <div className="flex flex-col">
                <label className="mb-1.5 text-sm text-zinc-300">Team Size</label>
                <select {...hackathonForm.register('teamSize')} className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-cyan-400 focus:outline-none appearance-none">
                  {[1, 2, 3, 4, 5].map(num => <option key={num} value={num}>{num} Person{num > 1 ? 's' : ' (Solo)'}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold border-b border-zinc-800 pb-2 text-cyan-400">Team Leader</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Render leader fields via mapping */}
              {hackathonLeaderFields.map(field => renderInput(field, hackathonForm))}
            </div>
          </div>

          {currentTeamSize > 1 && (
            <div className="space-y-6 pt-4">
              <h3 className="text-xl font-bold border-b border-zinc-800 pb-2 text-cyan-400">Team Members</h3>
              {Array.from({ length: currentTeamSize - 1 }).map((_, index) => (
                <div key={index} className="p-5 border border-zinc-700/50 rounded-xl bg-black/40 space-y-4">
                  <h4 className="text-white font-bold bg-zinc-800/50 inline-block px-3 py-1 rounded-md">Member {index + 1}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Render dynamic member fields via mapping */}
                    {memberFields.map(field => renderInput(field, hackathonForm, `members.${index}`))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-center my-4 min-h-[65px]">
            <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''} />
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-white text-black font-bold py-4 px-4 rounded-full hover:bg-cyan-400 transition-colors mt-6 text-lg disabled:cursor-not-allowed disabled:opacity-60">
            SUBMIT HACKATHON REGISTRATION →
          </button>
        </form>
      )}

      {/* WORKSHOP FORM */}
      {formType === 'workshop' && (
        <form onSubmit={workshopForm.handleSubmit(onWorkshopSubmit)} className="space-y-5 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Render workshop fields via mapping */}
            {workshopFields.map(field => renderInput(field, workshopForm))}
          </div>
          <div className="flex justify-center my-4 min-h-[65px]">
            <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''} />
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-white text-black font-bold py-4 px-4 rounded-full hover:bg-cyan-400 transition-colors mt-6 text-lg disabled:cursor-not-allowed disabled:opacity-60">
            SUBMIT WORKSHOP REGISTRATION →
          </button>
        </form>
      )}

      {isSubmitting && (
        <p role="status" aria-live="polite" className="mt-6 text-center text-sm text-cyan-400">
          Submitting your registration...
        </p>
      )}

      {!isSubmitting && submissionStatus.type !== 'idle' && (
        <p
          role={submissionStatus.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`mt-6 text-center text-sm ${submissionStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}
        >
          {submissionStatus.message}
        </p>
      )}

    </div>
  );
}
