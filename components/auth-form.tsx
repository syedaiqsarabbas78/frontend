"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ApiError, api } from "@/lib/api";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isSignup = mode === "signup";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await api(isSignup ? "/auth/signup" : "/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.replace("/chat");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center overflow-y-auto bg-[#141210] px-4 py-6 text-[#f4efe6] sm:px-6">
      <form
        onSubmit={onSubmit}
        className="my-auto w-full max-w-sm rounded-2xl border border-[#e7d7c3]/15 bg-[#1c1916] p-4 shadow-2xl sm:p-5"
      >
        <p className="text-xs tracking-wide text-[#e7d7c3]">Harbor</p>
        <h1 className="mt-1.5 text-xl font-semibold">{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-1.5 text-xs text-[#a3988c]">
          {isSignup ? "Use an email and a password of at least 8 characters." : "Sign in with the same email and password."}
        </p>
        <label className="mt-4 block text-xs" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-md border border-[#e7d7c3]/15 bg-[#141210] px-2.5 py-2 text-base outline-none focus-visible:border-[#e7d7c3]"
        />
        <label className="mt-3 block text-xs" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-md border border-[#e7d7c3]/15 bg-[#141210] px-2.5 py-2 text-base outline-none focus-visible:border-[#e7d7c3]"
        />
        {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-4 min-h-9 w-full rounded-md bg-[#e7d7c3] px-3 py-2 text-sm font-medium text-[#2a2118] disabled:opacity-60"
        >
          {pending ? "Please wait..." : isSignup ? "Sign up" : "Log in"}
        </button>
        <p className="mt-3 text-xs text-[#a3988c]">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link className="text-[#e7d7c3] underline" href="/login">
                Log in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link className="text-[#e7d7c3] underline" href="/signup">
                Sign up
              </Link>
            </>
          )}
        </p>
      </form>
    </main>
  );
}
