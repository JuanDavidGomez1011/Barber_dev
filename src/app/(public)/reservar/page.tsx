import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { getCatalog } from "@/server/catalog";

export const metadata: Metadata = { title: "Reservar" };

export default async function ReservarPage() {
  const { services, barbers } = await getCatalog();

  return (
    <div className="pt-6">
      {/* El asistente lee ?servicio= de la URL, que solo se conoce al momento de la visita */}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-ink-900" />}>
        <BookingWizard services={services} barbers={barbers} />
      </Suspense>
    </div>
  );
}
