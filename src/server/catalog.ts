import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "./db";

/** Etiqueta de caché del catálogo. El panel de admin la invalida al editar. */
export const CATALOG_TAG = "catalog";

export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCop: number;
};

export type PublicBarber = {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  serviceIds: string[];
};

export type PublicBusiness = {
  name: string;
  city: string;
  address: string | null;
  whatsapp: string | null;
  timezone: string;
  minLeadMinutes: number;
  cancelLimitMinutes: number;
};

/** Datos públicos que cambian poco: se cachean y se invalidan con `CATALOG_TAG`. */
export async function getCatalog(): Promise<{
  business: PublicBusiness;
  services: PublicService[];
  barbers: PublicBarber[];
}> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const [settings, services, barbers] = await Promise.all([
    db.businessSettings.findUniqueOrThrow({ where: { id: 1 } }),
    db.service.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.barber.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { services: { select: { serviceId: true } } },
    }),
  ]);

  return {
    business: {
      name: settings.name,
      city: settings.city,
      address: settings.address,
      whatsapp: settings.whatsapp,
      timezone: settings.timezone,
      minLeadMinutes: settings.minLeadMinutes,
      cancelLimitMinutes: settings.cancelLimitMinutes,
    },
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMin: s.durationMin,
      priceCop: s.priceCop,
    })),
    barbers: barbers.map((b) => ({
      id: b.id,
      name: b.name,
      bio: b.bio,
      photoUrl: b.photoUrl,
      serviceIds: b.services.map((s) => s.serviceId),
    })),
  };
}
