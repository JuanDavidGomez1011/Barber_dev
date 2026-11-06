import { Checkbox, Field, inputClass } from "./ui";

export type BarberValues = {
  id?: string;
  name?: string;
  bio?: string | null;
  photoUrl?: string | null;
  email?: string;
  sortOrder?: number;
  active?: boolean;
  serviceIds?: string[];
};

/** Campos del barbero, compartidos por crear y editar. */
export function BarberFields({
  b,
  services,
  withPassword,
}: {
  b: BarberValues;
  services: { id: string; name: string; active: boolean }[];
  withPassword?: boolean;
}) {
  return (
    <>
      {b.id && <input type="hidden" name="id" value={b.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre">
          <input name="name" required maxLength={60} defaultValue={b.name} className={inputClass} />
        </Field>
        <Field label="Correo para entrar al panel">
          <input name="email" type="email" required defaultValue={b.email} autoComplete="off" className={inputClass} />
        </Field>
        {withPassword && (
          <Field label="Contraseña inicial" hint="Mínimo 8 caracteres. El barbero puede pedirte cambiarla.">
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
          </Field>
        )}
        <Field label="Foto (URL, opcional)">
          <input name="photoUrl" type="url" defaultValue={b.photoUrl ?? ""} placeholder="https://…" className={inputClass} />
        </Field>
        <Field label="Descripción corta (opcional)" className="sm:col-span-2">
          <input name="bio" maxLength={200} defaultValue={b.bio ?? ""} className={inputClass} />
        </Field>
        <Field label="Orden en la lista">
          <input name="sortOrder" type="number" min={0} max={999} defaultValue={b.sortOrder ?? 0} className={inputClass} />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox name="active" label="Activo (recibe reservas y puede entrar)" defaultChecked={b.active ?? true} />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm text-ink-300">Servicios que presta</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {services.map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded-xl border border-ink-800 px-3 py-2 text-sm">
              <input
                type="checkbox"
                name="serviceIds"
                value={s.id}
                defaultChecked={b.serviceIds?.includes(s.id) ?? true}
                className="size-4 accent-brass-400"
              />
              {s.name}
              {!s.active && <span className="text-xs text-ink-500">(oculto)</span>}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
