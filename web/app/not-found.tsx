import Link from "next/link";

export default function NotFound() {
  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <h1 className="text-4xl font-bold text-foreground">404</h1>
      <p className="mt-4 max-w-md text-center text-muted">
        Página no encontrada / Page not found
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm font-semibold">
        <Link href="/" className="text-accent hover:underline">
          Inicio / Home (ES)
        </Link>
        <Link href="/en" className="text-accent hover:underline">
          English home
        </Link>
        <Link href="/zones" className="text-accent hover:underline">
          Barrios / Zones
        </Link>
      </div>
    </div>
  );
}
