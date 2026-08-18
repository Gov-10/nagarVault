"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === "test@example.com" && password === "password") {
      router.push("/dashboard");
    } else {
      alert("Invalid credentials");
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
        <label className="block mb-2 text-sm font-semibold">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full p-2 mb-4 rounded-md bg-neutral-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all hover:bg-neutral-700"
        />
        <label className="block mb-2 text-sm font-semibold">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full p-2 mb-6 rounded-md bg-neutral-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all hover:bg-neutral-700"
        />
        <button
          type="submit"
          className="w-full py-2 rounded-md bg-gradient-to-r from-blue-700 to-blue-500 text-white font-semibold hover:opacity-90 transition-all shadow-lg hover:shadow-blue-900/50"
        >
          Login
        </button>
      </form>
    </div>
  );
}
