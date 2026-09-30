import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { About } from "@/components/landing/About";
import { Attractions } from "@/components/landing/Attractions";
import { Benefits } from "@/components/landing/Benefits";
import { CallToAction } from "@/components/landing/CallToAction";
import { Categories } from "@/components/landing/Categories";
import { Faq } from "@/components/landing/Faq";
import { FocusDomains } from "@/components/landing/FocusDomains";
import { Gallery } from "@/components/landing/Gallery";
import { Hero } from "@/components/landing/Hero";
import { LiveUpdates } from "@/components/landing/LiveUpdates";
import { Participants } from "@/components/landing/Participants";
import { Prizes } from "@/components/landing/Prizes";
import { Rules } from "@/components/landing/Rules";
import { Stats } from "@/components/landing/Stats";
import { Timeline } from "@/components/landing/Timeline";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <LiveUpdates />
      <main>
        <Hero />
        <Stats />
        <About />
        <Benefits />
        <FocusDomains />
        <Categories />
        <Participants />
        <Timeline />
        <Prizes />
        <Rules />
        <Attractions />
        <Gallery />
        <Faq />
        <CallToAction />
      </main>
      <SiteFooter />
    </>
  );
}
