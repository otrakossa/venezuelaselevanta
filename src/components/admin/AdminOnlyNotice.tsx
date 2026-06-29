import { Link } from "@tanstack/react-router";
import { Lock, ArrowLeft } from "lucide-react";
import { AdminNav } from "./AdminNav";

export function AdminOnlyNotice({ section }: { section: string }) {
  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6">
      <AdminNav />
      <div className="mt-6 border border-border rounded-xl bg-gradient-to-br from-[color:var(--sunrise)]/5 to-amber-50 p-8 text-center">
        <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-[color:var(--sunrise)]/15 flex items-center justify-center">
          <Lock className="h-7 w-7 text-[color:var(--sunrise)]" />
        </div>
        <h1 className="text-xl font-bold mb-2">Sección solo para administradores</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-1">
          Tu rol de <strong>moderador</strong> no tiene acceso a <strong>{section}</strong>.
        </p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto mb-5">
          Si necesitas entrar aquí, pídele a un administrador que te eleve el rol desde el panel de Usuarios.
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-xs px-4 py-2 bg-[color:var(--sunrise)] text-white rounded-md font-semibold"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Ir a Moderación
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs px-4 py-2 border border-border rounded-md hover:bg-muted"
          >
            Volver al sitio
          </Link>
        </div>
      </div>
    </div>
  );
}
