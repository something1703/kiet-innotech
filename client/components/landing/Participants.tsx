import { ChevronRight, GraduationCap, School, University } from "lucide-react";
import { participantTracks } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";
import { Slider } from "@/components/ui/Slider";
import { Section, SectionHeading } from "@/components/ui/Section";

const trackIcons = [University, GraduationCap, School];

export function Participants() {
  return (
    <Section id="participate" className="relative overflow-hidden bg-navy-900">
      <div className="bg-grid absolute inset-0" aria-hidden="true" />
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true" />

      <div className="relative">
        <SectionHeading
          tone="dark"
          eyebrow="Who can participate"
          title="Three ways to join InnoTech26"
          description="KIET teams compete at department level first. Teams from other colleges and schools go straight to the Grand Finale."
        />

        <Slider
          label="Ways to participate"
          tone="dark"
          gridClassName="md:gap-6 lg:grid-cols-3"
          slides={participantTracks.map((track, index) => {
            const TrackIcon = trackIcons[index];
            return {
              key: track.title,
              className: "flex",
              content: (
                <Reveal delay={index * 120} className="flex w-full">
                  <div className="flex h-full w-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm transition duration-300 hover:border-brand-400/50 hover:bg-white/[0.07]">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
                      <TrackIcon size={24} aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-display text-xl font-bold text-white">{track.title}</h3>
                      <p className="text-sm text-slate-400">{track.audience}</p>
                    </div>
                  </div>

                  {/* Journey */}
                  <ol className="my-6 flex flex-wrap items-center gap-2" aria-label={`${track.title} journey`}>
                    {track.steps.map((step, stepIndex) => (
                      <li key={step} className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            stepIndex === track.steps.length - 1
                              ? "bg-accent-500 text-white"
                              : "bg-white/10 text-slate-200"
                          }`}
                        >
                          {step}
                        </span>
                        {stepIndex < track.steps.length - 1 && (
                          <ChevronRight size={14} className="text-slate-500" aria-hidden="true" />
                        )}
                      </li>
                    ))}
                  </ol>

                  <ul className="space-y-3 border-t border-white/10 pt-6">
                    {track.points.map((point) => (
                      <li key={point} className="flex gap-3 text-sm text-slate-300">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden="true" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                </Reveal>
              ),
            };
          })}
        />
      </div>
    </Section>
  );
}
