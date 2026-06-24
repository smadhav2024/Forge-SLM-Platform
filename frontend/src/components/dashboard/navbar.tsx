import Link from "next/link";
import Image from "next/image";
import { Tienne } from "next/font/google"; // <-- Import Google Fonts
import { ThemeToggle } from "@/components/theme-toggle";
import { NavTabs } from "@/components/dashboard/nav-tabs";
import { TokenBadge } from "@/components/dashboard/token-badge";
import { UserMenu } from "@/components/dashboard/user-menu";

// Initialize the Tienne font
const tienne = Tienne({
  subsets: ["latin"],
  weight: ["400", "700"],
});

export function Navbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-6">
        {/* Adjusted gap-2 to gap-3 for better breathing room between icon and text */}
        <Link href="/dashboard" className="flex items-center gap-3">
          {/* Circular Logo Container */}
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <Image
              src="/logo.png"
              alt="Forge Logo"
              fill // <-- Replaces width={32} and height={32}
              sizes="32px" // <-- Tells Next.js exactly how small to make the image
              className="object-cover"
            />
          </div>

          {/* Styled Text matching the image */}
          <span
            className={`${tienne.className} text-xl font-bold uppercase tracking-[0.15em]`}
          >
            Forge
          </span>
        </Link>
        <NavTabs />
      </div>

      <div className="flex items-center gap-3">
        <TokenBadge />
        <UserMenu />
        <ThemeToggle />
      </div>
    </header>
  );
}
