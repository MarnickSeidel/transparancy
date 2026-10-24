import Link from "next/link";

import { localePath } from "@/lib/locale";

export default function NotFound() {
  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <h1 className="text-4xl font-bold text-foreground">404</h1>
      <p className="mt-4 max-w-md text-center text-muted">
        Página no encontrada
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm font-semibold">
        <Link href="/" className="text-accent hover:underline">
          Inicio
        </Link>
        <Link href={localePath("es", "/zones")} className="text-accent hover:underline">
          Barrios
        </Link>
      </div>
    </div>
  );
}
