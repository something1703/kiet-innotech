import Image from "next/image";
import { gallery } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Slider } from "@/components/ui/Slider";

export function Gallery() {
  return (
    <Section id="campus" className="bg-surface">
      <SectionHeading
        eyebrow="The venue"
        title="For InnoTech"
        description="The Grand Finale takes place on the KIET campus in Delhi-NCR, Ghaziabad."
      />
      {/* Phones: one photo at a time, with its caption. From md up: the photo grid. */}
      <Slider
        label="Campus photos"
        slideWidth="w-[86%] sm:w-[70%]"
        gridClassName="md:grid-flow-row-dense md:auto-rows-[220px] md:grid-cols-2 md:gap-4 lg:grid-cols-4"
        slides={gallery.map((photo, index) => ({
          key: photo.src,
          className: `h-60 md:h-auto ${photo.wide ? "md:col-span-2" : ""}`,
          content: (
            <Reveal delay={(index % 4) * 70} className="group relative h-full w-full overflow-hidden rounded-2xl sm:rounded-3xl">
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes={photo.wide ? "(min-width: 1024px) 50vw, 90vw" : "(min-width: 1024px) 25vw, 90vw"}
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-navy-950/80 via-transparent to-transparent p-4 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100">
                <p className="text-sm font-medium text-white">{photo.alt}</p>
              </div>
            </Reveal>
          ),
        }))}
      />
    </Section>
  );
}
