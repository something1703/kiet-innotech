import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

/** Public pages other than the home page share the landing header and footer. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader linkBase="/" />
      <main>{children}</main>
      <SiteFooter linkBase="/" />
    </>
  );
}
