"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ProfileData = { name: string; username: string; role: string };
type DashboardState =
  | { phase: "loading" }
  | { phase: "ready"; profile: ProfileData }
  | { phase: "error" };

function deleteCookie() {
  document.cookie = "session_token=; Max-Age=0; path=/";
}

function getSessionToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)session_token=([^;]+)/);
  return match ? match[1] : null;
}

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>({ phase: "loading" });
  const router = useRouter();

  useEffect(() => {
    const token = getSessionToken();

    // Requirement 1.2 — no cookie → redirect to /login immediately
    if (!token) {
      router.push("/login");
      return;
    }

    // Requirement 1.7 — 5-second timeout via AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Requirement 1.4 — call GET /profile with the session token as Bearer
    fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/profile`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (res) => {
        clearTimeout(timeoutId);
        // Requirement 1.5 — non-2xx → delete cookie + redirect
        if (!res.ok) {
          deleteCookie();
          router.push("/login");
          return;
        }
        const data = (await res.json()) as ProfileData;
        // Requirement 1.3 — transition to ready with profile data
        setState({ phase: "ready", profile: data });
      })
      .catch(() => {
        clearTimeout(timeoutId);
        // Requirement 1.5 / 1.7 — network error or timeout → delete cookie + redirect
        deleteCookie();
        router.push("/login");
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [router]);

  // Requirement 1.6 — show spinner while loading, suppress welcome message
  if (state.phase === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800">
        <div className="flex flex-col items-center gap-4 text-blue-300">
          <div className="h-12 w-12 rounded-full border-4 border-blue-400 border-t-transparent animate-spin" />
          <p className="text-sm font-medium tracking-wide">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  // error phase is a transient state before the redirect fires; render nothing visible
  if (state.phase === "error") {
    return null;
  }

  // Requirement 1.3 — render welcome message with username and role
  const { profile } = state;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 text-gray-200">
      {/* Top navigation bar */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-neutral-900/80 backdrop-blur-lg border-b border-blue-800 px-6 py-3 flex items-center justify-between shadow-lg">
        <span className="text-blue-400 font-bold text-lg tracking-wide">NagarVault</span>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span>
            Signed in as{" "}
            <span className="text-gray-200 font-semibold">{profile.username}</span>
          </span>
          <span className="px-2 py-0.5 rounded-full bg-blue-800 text-blue-200 text-xs font-medium uppercase tracking-wider">
            {profile.role}
          </span>
          <a
            href="/api/logout"
            onClick={async (e) => {
              e.preventDefault();
              await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/logout`, {
                credentials: "include",
              });
              deleteCookie();
              router.push("/login");
            }}
            className="ml-4 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
          >
            Logout
          </a>
        </div>
      </div>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center pt-16 px-6">
        <div className="bg-neutral-900/90 backdrop-blur-lg rounded-2xl shadow-2xl border border-blue-700 p-10 max-w-lg w-full text-center">
          {/* Welcome heading — Requirement 1.3 */}
          <h1 className="text-3xl font-bold text-blue-400 mb-2">
            Welcome, {profile.username}
          </h1>
          <p className="text-gray-400 text-sm mb-6">You are logged in to NagarVault.</p>

          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-gray-400">Your role:</span>
            <span className="px-3 py-1 rounded-full bg-blue-800 text-blue-200 font-semibold uppercase tracking-wider text-xs">
              {profile.role}
            </span>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <a
              href="/chatbot"
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-semibold transition-all shadow-md hover:shadow-blue-900/50"
            >
              <span>💬</span>
              <span>Open Chatbot</span>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
