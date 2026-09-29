import type { Metadata } from "next";
import { AdminsView } from "@/components/admins/AdminsView";

export const metadata: Metadata = { title: "Admins" };

export default function AdminsPage() {
  return <AdminsView />;
}
