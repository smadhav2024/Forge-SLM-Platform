import Image from "next/image";
import { Tienne } from "next/font/google";

const tienne = Tienne({ subsets: ["latin"], weight: ["400", "700"] });

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          {/* Logo — same circular style as the navbar */}
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <Image
              src="/logo.png"
              alt="Forge Logo"
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
          <span className={`${tienne.className} text-2xl font-bold uppercase tracking-[0.15em]`}>
            Forge
          </span>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        {children}

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {footer}
        </div>
      </div>
    </div>
  );
}