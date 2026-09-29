import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { About } from "@/components/landing/About";
import { Attractions } from "@/components/landing/Attractions";
import { CallToAction } from "@/components/landing/CallToAction";
import { Categories } from "@/components/landing/Categories";
import { CoreTeam } from "@/components/landing/CoreTeam";
import { Faq } from "@/components/landing/Faq";
import { Gallery } from "@/components/landing/Gallery";
import { Hero } from "@/components/landing/Hero";
import { Judging } from "@/components/landing/Judging";
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
        <Categories />
        <Participants />
        <Timeline />
        <Prizes />
        <Judging />
        <Rules />
        <Attractions />
        <Gallery />
        <Faq />
        <CoreTeam />
        <CallToAction />
      </main>
      <SiteFooter />
    </>
  );
}
