"use client";

import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Artist Tracker</h1>
      <button
        onClick={handleGoogleLogin}
        className="rounded-md bg-black px-4 py-2 text-white"
      >
        Sign in with Google
      </button>
    </main>
  );
}
