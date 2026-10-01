import Image from "next/image";
import { Reveal } from "@/components/ui/Reveal";
import { RegisterCta, RegistrationNote } from "./RegisterCta";

export function CallToAction() {
  return (
    <section className="px-4 pb-20 sm:px-6 lg:px-8">
      <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-navy-900 px-6 py-14 text-center sm:px-12 sm:py-20">
        <Image
          src="/images/kiet/infra-3.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-20"
        />
        <div className="bg-grid absolute inset-0" aria-hidden="true" />
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-accent-500/30 blur-3xl" aria-hidden="true" />

        <div className="relative">
          <h2 className="mx-auto max-w-3xl font-display text-3xl font-bold text-white sm:text-5xl">
            Have an idea that can change things?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-300 sm:text-lg">
            <RegistrationNote />
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <RegisterCta
              label="Register Now"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-accent-500 px-8 py-4 font-semibold text-white shadow-xl shadow-accent-500/30 transition hover:-translate-y-0.5 hover:bg-accent-600"
            />
            <a
              href="#rules"
              className="inline-flex items-center justify-center rounded-full border border-white/25 px-8 py-4 font-semibold text-white transition hover:bg-white/10"
            >
              Read the Rules
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
