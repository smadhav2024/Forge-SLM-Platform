import Link from "next/link";
import Image from "next/image"; // <-- Added Next.js Image import
import { ThemeToggle } from "@/components/theme-toggle";
import { NavTabs } from "@/components/dashboard/nav-tabs";
import { TokenBadge } from "@/components/dashboard/token-badge";
import { UserMenu } from "@/components/dashboard/user-menu";

export function Navbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          {/* Logo Container: Changed w-7 to w-auto */}
          <div className="flex h-7 w-auto items-center justify-center overflow-hidden">
            <Image
              src="/logo.png"
              alt="Forge Logo"
              width={60} // <-- Proportional width
              height={28} // <-- Matches the h-7 container height
              className="object-contain"
              quality={75} // <-- Added to ensure the logo stays perfectly crisp
            />
          </div>
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
