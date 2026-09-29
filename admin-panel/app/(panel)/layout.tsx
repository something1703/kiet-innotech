import { PanelShell } from "@/components/layout/PanelShell";

export default function PanelLayout({ children }: LayoutProps<"/">) {
  return <PanelShell>{children}</PanelShell>;
}
