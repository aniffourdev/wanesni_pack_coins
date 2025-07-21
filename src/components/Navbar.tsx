'use client';

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Cookies from "js-cookie";

const Navbar = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!Cookies.get("access_token"));
    setMounted(true);
    // Optionally, listen for cookie changes if your app supports login/logout from other tabs
    // You could use a polling interval or a custom event for more advanced cases
  }, []);

  if (!mounted) return null;

  const handleLogout = () => {
    Cookies.remove("access_token", { path: "/" });
    Cookies.remove("refresh_token", { path: "/" });
    window.location.href = "/login";
  };

  return (
    <ul className="py-5 max-w-2xl mx-auto flex justify-center items-center gap-2.5">
      <li>
        <Link
          href="/"
          className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium px-4 py-0.5 pb-1 rounded-full shadow"
        >
          Home
        </Link>
      </li>
      <li>
        <Link
          href="/purchase"
          className="bg-sky-100 hover:bg-sky-200 text-sky-800 font-medium px-4 py-0.5 pb-1 rounded-full shadow"
        >
          Buy Coins
        </Link>
      </li>
      <li>
        <Link
          href="/chat"
          className="bg-pink-100 hover:bg-pink-200 text-pink-800 font-medium px-4 py-0.5 pb-1 rounded-full shadow"
        >
          Chatbox
        </Link>
      </li>
      <li>
        <Link
          href="/purchase-history"
          className="bg-green-100 hover:bg-green-200 text-green-800 font-medium px-4 py-0.5 pb-1 rounded-full shadow"
        >
          Transactions
        </Link>
      </li>
      <li>
        <Link
          href="/video-call"
          className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-medium px-4 py-0.5 pb-1 rounded-full shadow"
        >
          Random Call
        </Link>
      </li>
      {!isLoggedIn && (
        <li>
          <Link
            href="/login"
            className="bg-violet-100 hover:bg-violet-200 text-violet-800 font-medium px-4 py-0.5 pb-1 rounded-full shadow"
          >
            Sign In
          </Link>
        </li>
      )}
      {isLoggedIn && (
        <li>
          <button
            onClick={handleLogout}
            className="bg-red-100 hover:bg-red-200 text-red-800 font-medium cursor-pointer px-4 py-0.5 pb-1 rounded-full shadow"
          >
            Log out
          </button>
        </li>
      )}
    </ul>
  );
};

export default Navbar;
