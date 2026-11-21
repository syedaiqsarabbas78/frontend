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
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-10">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#171717] p-6 shadow-2xl"
      >
        <p className="text-sm text-zinc-400">Harbor Chat</p>
        <h1 className="mt-2 text-2xl font-semibold">{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {isSignup ? "Use an email and a password of at least 8 characters." : "Sign in with the same email and password."}
        </p>
        <label className="mt-6 block text-sm" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 outline-none focus-visible:border-white"
        />
        <label className="mt-4 block text-sm" htmlFor="password">
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
          className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 outline-none focus-visible:border-white"
        />
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-lg bg-white px-3 py-2 font-medium text-black disabled:opacity-60"
        >
          {pending ? "Please wait..." : isSignup ? "Sign up" : "Log in"}
        </button>
        <p className="mt-4 text-sm text-zinc-400">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link className="text-white underline" href="/login">
                Log in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link className="text-white underline" href="/signup">
                Sign up
              </Link>
            </>
          )}
        </p>
      </form>
    </main>
  );
}
