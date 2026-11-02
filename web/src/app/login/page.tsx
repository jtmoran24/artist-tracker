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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="vapor-sun w-56 sm:w-72" aria-hidden />
      <div>
        <h1 className="vapor-heading text-4xl leading-tight sm:text-6xl">
          ＡＲＴＩＳＴ
          <br />
          ＴＲＡＣＫＥＲ
        </h1>
        <p className="pixel mt-3 text-xl text-pink">アーティスト・トラッカー</p>
        <p className="mt-2 text-sm text-sage">
          Know the moment your artists announce a show near you.
        </p>
      </div>
      <button onClick={handleGoogleLogin} className="btn btn-primary text-xl">
        Sign in with Google
      </button>
    </main>
  );
}
