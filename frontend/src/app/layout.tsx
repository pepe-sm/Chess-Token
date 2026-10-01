import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Header } from "../components/Navigation/Header";

export const metadata: Metadata = {
  title: "Pi Maia Chess - Tokenized Human-AI Chess Platform",
  description:
    "Full-stack Web3 tokenized chess application powered by the Maia Chess engine and Pi Network SDK, featuring bonding curves, 1v1 wagers, and ranked matchmaking.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Official Pi Network SDK */}
        <Script
          src="https://sdk.minepi.com/pi-sdk.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-amber-500 selection:text-slate-950">
        <Header />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="w-full border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span>© 2026 Pi Maia Chess Ecosystem. All rights reserved.</span>
            <div className="flex items-center space-x-4 text-slate-400">
              <span>Maia-1100 / 1500 / 1900 Engine</span>
              <span>•</span>
              <span>Pi Network SDK v2.0</span>
              <span>•</span>
              <span>Hardhat EVM Contracts</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
