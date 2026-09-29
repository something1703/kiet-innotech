import type { Metadata } from "next";
import { PortalShell } from "@/components/portal/PortalShell";

export const metadata: Metadata = {
  title: "Student Portal | InnoTech'26",
  robots: { index: false },
};

export default function PortalLayout({ children }: LayoutProps<"/">) {
  return <PortalShell>{children}</PortalShell>;
}
