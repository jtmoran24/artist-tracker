import Link from "next/link";
import { signOut } from "@/app/actions";
import { createClient } from "@/utils/supabase/server";
import { NavLinks } from "./NavLinks";
import { Ticker } from "./Ticker";

export async function NavBar() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-mint/20 bg-forest-950/80 backdrop-blur-md">
      <nav className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/feed" className="flex items-center gap-2">
          <div className="vapor-sun w-7" aria-hidden />
          <span className="vapor-heading text-lg">ＡＲＴＩＳＴ　ＴＲＡＣＫＥＲ</span>
        </Link>
        <NavLinks />
        <form action={signOut} className="ml-auto">
          <button type="submit" className="pixel text-lg text-sage hover:text-pink">
            sign out
          </button>
        </form>
      </nav>
      <Ticker />
    </header>
  );
}
