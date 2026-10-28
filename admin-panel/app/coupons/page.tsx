import type { Metadata } from "next";
import { Suspense } from "react";
import { CouponSheet } from "@/components/desk/CouponSheet";

export const metadata: Metadata = { title: "Lunch coupons" };

export default function CouponsPage() {
  return (
    <Suspense>
      <CouponSheet />
    </Suspense>
  );
}
