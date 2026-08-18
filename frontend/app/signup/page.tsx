"use client";

import { useState } from "react";

export default function SignupPage() {
  const [formData, setFormData] = useState({
    fullname: "",
    username: "",
    userid: "",
    password: "",
    role: "",
  });
  const [strength, setStrength] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (name === "password") {
      checkStrength(value);
    }
  };

  const checkStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) setStrength("Weak");
    else if (score === 3) setStrength("Medium");
    else setStrength("Strong");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.fullname,
            username: formData.username,
            user_id: formData.userid,
            password: formData.password,
            role: formData.role,
          }),
        }
      );
      if (res.ok) {
        alert("Signup successful! You can now log in.");
        setFormData({ fullname: "", username: "", userid: "", password: "", role: "" });
        setStrength("");
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Signup failed: ${(data as { detail?: string }).detail ?? "Please try again."}`);
      }
    } catch {
      alert("Unable to reach the auth service. Please try again later.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-950 via-blue-950 to-black text-white">
      <form
        onSubmit={handleSubmit}
        className="bg-neutral-900/80 backdrop-blur-lg p-8 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.6)] w-96 border border-blue-800 transition-transform hover:scale-[1.02]"
      >
        <h2 className="text-3xl font-extrabold mb-6 text-center text-blue-400 tracking-wide">
          Signup
        </h2>

        <label className="block mb-2 text-sm font-semibold">Full Name</label>
        <input
          type="text"
          name="fullname"
          value={formData.fullname}
          onChange={handleChange}
          required
          className="w-full p-2 mb-4 rounded-md bg-neutral-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all hover:bg-neutral-700"
        />

        <label className="block mb-2 text-sm font-semibold">Username</label>
        <input
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
          required
          className="w-full p-2 mb-4 rounded-md bg-neutral-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all hover:bg-neutral-700"
        />

        <label className="block mb-2 text-sm font-semibold">User ID</label>
        <input
          type="text"
          name="userid"
          value={formData.userid}
          onChange={handleChange}
          required
          className="w-full p-2 mb-4 rounded-md bg-neutral-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all hover:bg-neutral-700"
        />

        <label className="block mb-2 text-sm font-semibold">Password</label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          required
          className="w-full p-2 rounded-md bg-neutral-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all hover:bg-neutral-700"
        />
        {strength && (
          <p
            className={`mt-2 text-sm font-semibold ${
              strength === "Weak"
                ? "text-red-400"
                : strength === "Medium"
                ? "text-yellow-400"
                : "text-green-400"
            }`}
          >
            Password Strength: {strength}
          </p>
        )}

        <label className="block mt-4 mb-2 text-sm font-semibold">Role</label>
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          required
          className="w-full p-2 mb-6 rounded-md bg-neutral-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all hover:bg-neutral-700"
        >
          <option value="">Select Role</option>
          <option value="User">User</option>
        </select>

        <button
          type="submit"
          className="w-full py-2 rounded-md bg-gradient-to-r from-blue-800 to-blue-600 text-white font-semibold hover:opacity-90 transition-all shadow-lg hover:shadow-blue-900/50"
        >
          Signup
        </button>
      </form>
    </div>
  );
}
