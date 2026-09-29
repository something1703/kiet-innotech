import Image from "next/image";
import { gallery } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";

export function Gallery() {
  return (
    <Section id="campus" className="bg-surface">
      <SectionHeading
        eyebrow="The venue"
        title="Life at KIET"
        description="The Grand Finale takes place on the KIET campus in Delhi-NCR, Ghaziabad."
      />
      <ul className="grid grid-flow-row-dense auto-rows-[180px] grid-cols-2 gap-3 sm:auto-rows-[220px] sm:gap-4 lg:grid-cols-4">
        {gallery.map((photo, index) => (
          <Reveal
            as="li"
            key={photo.src}
            delay={(index % 4) * 70}
            className={`group relative overflow-hidden rounded-2xl sm:rounded-3xl ${photo.wide ? "col-span-2" : ""}`}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes={photo.wide ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"}
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 flex items-end bg-gradient-to-t from-navy-950/80 via-transparent to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <p className="text-sm font-medium text-white">{photo.alt}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
