"use client";

import { useState } from "react";

export default function Home() {
  const [message, setMessage] = useState("");

  const handleMicClick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      alert("Microphone access granted!");
      console.log(stream);
    } catch (err) {
      alert("Microphone access denied!");
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-black text-white relative">
      {/* Sidebar */}
      <aside className="w-64 bg-neutral-900/90 backdrop-blur-lg border-r border-blue-800 flex flex-col p-4 shadow-xl">
        <button className="bg-blue-800 hover:bg-blue-700 text-sm py-2 px-3 rounded mb-2 transition-all">
          + New chat
        </button>
        <div className="text-gray-400 text-sm mb-4 hover:text-white cursor-pointer">Department</div>
        <div className="text-gray-400 text-sm mb-4 hover:text-white cursor-pointer">Projects</div>

        <div className="mt-6 text-gray-500 text-xs uppercase">Recents</div>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col justify-end items-center relative">
        {/* Big centered welcome text (Comic Sans, disappears when typing starts) */}
        {message === "" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <h1
              className="text-6xl font-bold text-blue-400 tracking-wide"
              style={{ fontFamily: "Comic Sans MS, Comic Sans, cursive" }}
            >
              Welcome to NagarVault
            </h1>
          </div>
        )}

        {/* Typing area at bottom */}
        <div className="flex items-center bg-neutral-900/80 backdrop-blur-md rounded-full px-4 py-3 w-[90%] mb-6 shadow-2xl border-2 border-blue-600 ring-2 ring-blue-400/50 z-10">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="bg-transparent flex-1 outline-none text-gray-300 placeholder-gray-500"
          />

          {/* Send button */}
          <button className="ml-3 bg-blue-800 hover:bg-blue-700 text-gray-200 px-4 py-2 rounded-full transition-all shadow-md flex items-center space-x-2">
            <span>Send</span>
            <span>➤</span>
          </button>

          {/* Mic button (messenger-style) */}
          <button
            onClick={handleMicClick}
            className="ml-2 bg-blue-700 hover:bg-blue-600 text-white p-2 rounded-full shadow-md transition-all"
            title="Use microphone"
          >
            {/* SVG mic icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 14 0h-2zM11 18h2v3h-2v-3z" />
            </svg>
          </button>
        </div>
      </main>
    </div>
  );
}
