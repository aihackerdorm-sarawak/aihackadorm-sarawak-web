"use client";

import Image from "next/image";

const eventPhotos = [
  "/event_pic/pic1.jpeg",
  "/event_pic/pic2.jpeg",
  "/event_pic/pic3.jpeg",
  "/event_pic/pic4.jpeg",
  "/event_pic/pic5.jpeg",
];

export function EventGallery() {
  const marqueePhotos = [...eventPhotos, ...eventPhotos];

  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-[#030303] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.42em] text-cyan-400/60">
          Highlights
        </p>
        <h2 className="mt-2 text-xl font-black uppercase tracking-[-0.04em] text-white sm:text-2xl">
          AI for Maker · 23–24 Aug 2026
        </h2>
      </div>

      <div className="relative mt-5">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#030303] to-transparent sm:w-32" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#030303] to-transparent sm:w-32" />

        <div className="event-gallery-track flex w-max gap-4 px-4">
          {marqueePhotos.map((src, index) => (
            <div
              key={`${src}-${index}`}
              className="relative h-56 w-80 shrink-0 overflow-hidden rounded-[24px] border border-white/10 bg-black/30 sm:h-64 sm:w-96"
            >
              <Image
                src={src}
                alt="AI Hackerdorm event photo"
                fill
                sizes="384px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}