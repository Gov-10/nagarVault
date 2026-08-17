"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("citizen");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, password, user_id: userId, role }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail ?? "Login failed. Please check your credentials.");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Unable to reach the auth service. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800">
      <form
        onSubmit={handleSubmit}
        className="bg-neutral-900/90 backdrop-blur-lg p-8 rounded-xl shadow-2xl w-80 text-gray-200 border border-blue-700 transition-transform hover:scale-[1.02]"
      >
        <h2 className="text-3xl font-bold mb-6 text-center text-blue-400">
          Login
        </h2>

        {error && (
          <p className="mb-4 text-sm text-red-400 text-center">{error}</p>
        )}

        <label className="block mb-2 text-sm font-semibold">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="w-full p-2 mb-4 rounded-md bg-neutral-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all hover:bg-neutral-700"
        />

        <label className="block mb-2 text-sm font-semibold">User ID</label>
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
          className="w-full p-2 mb-4 rounded-md bg-neutral-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all hover:bg-neutral-700"
        />

        <label className="block mb-2 text-sm font-semibold">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full p-2 mb-4 rounded-md bg-neutral-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all hover:bg-neutral-700"
        />

        <label className="block mb-2 text-sm font-semibold">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full p-2 mb-6 rounded-md bg-neutral-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all hover:bg-neutral-700"
        >
          <option value="citizen">Citizen</option>
          <option value="admin">Admin</option>
          <option value="official">Official</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-md bg-gradient-to-r from-blue-700 to-blue-500 text-white font-semibold hover:opacity-90 transition-all shadow-lg hover:shadow-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Logging in…" : "Login"}
        </button>
      </form>
    </div>
  );
}