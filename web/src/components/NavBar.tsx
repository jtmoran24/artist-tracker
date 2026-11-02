import Link from "next/link";
import { signOut } from "@/app/actions";
import { createClient } from "@/utils/supabase/server";

const links = [
  { href: "/feed", label: "Feed" },
  { href: "/artists", label: "Artists" },
  { href: "/locations", label: "Locations" },
];

export async function NavBar() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  return (
    <header className="border-b">
      <nav className="mx-auto flex w-full max-w-2xl items-center gap-4 px-6 py-3">
        <span className="font-semibold">Artist Tracker</span>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="text-sm hover:underline">
            {link.label}
          </Link>
        ))}
        <form action={signOut} className="ml-auto">
          <button type="submit" className="text-sm text-gray-500 hover:underline">
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
