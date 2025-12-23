"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Динамический импорт Lottie для избежания SSR проблем
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export default function Home() {
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    fetch("/animations/Mr Detective.json")
      .then((res) => res.json())
      .then((data) => setAnimationData(data))
      .catch((err) => console.error("Failed to load animation:", err));
  }, []);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0a0f]">
      {/* Background gradient effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-red-900/20 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-gradient-to-tr from-red-950/30 to-transparent blur-3xl" />
        <div className="absolute right-0 top-1/2 h-[400px] w-[400px] rounded-full bg-gradient-to-l from-slate-800/20 to-transparent blur-3xl" />
      </div>

      {/* Noise texture overlay */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 flex w-full flex-col items-center px-6 text-center"
      >
        {/* Detective Animation */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mb-2 flex h-[340px] w-[340px] -translate-x-6 items-center justify-center sm:h-[400px] sm:w-[400px]"
        >
          {animationData ? (
            <Lottie
              animationData={animationData}
              loop={true}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-red-900/30 border-t-red-600" />
            </div>
          )}
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-3 text-center font-display text-3xl font-bold tracking-tight text-white sm:text-4xl"
        >
          <span className="text-red-500">TRUE</span> КРОВЬ
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-5 text-center text-sm italic text-white/40"
        >
          «Каждое дело оставляет след...»
        </motion.p>

        {/* Features - Inline with separators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="mb-8 flex items-center justify-center gap-3 text-sm"
        >
          <span className="text-white/80">Викторины</span>
          <span className="text-red-500">•</span>
          <span className="text-white/80">Дуэли</span>
          <span className="text-red-500">•</span>
          <span className="text-white/80">Расследования</span>
          <span className="text-red-500">•</span>
          <span className="text-white/80">Турниры</span>
        </motion.div>

        {/* Play Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <a
            href="/miniapp"
            className="group relative block overflow-hidden rounded-2xl bg-gradient-to-r from-red-700 to-red-600 px-16 py-4 text-lg font-bold uppercase tracking-widest text-white shadow-xl shadow-red-900/40 transition-all duration-300 hover:shadow-red-800/50"
          >
            {/* Button glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            
            {/* Button shine effect */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            
            <span className="relative z-10">ИГРАТЬ</span>
          </a>
        </motion.div>

        {/* Stats hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="mt-6 flex items-center gap-4 text-xs text-white/30"
        >
          <div className="flex items-center gap-1">
            <span className="text-red-500/70">●</span>
            <span>500+ вопросов</span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div className="flex items-center gap-1">
            <span className="text-red-500/70">●</span>
            <span>Реальные дела</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Bottom - Created by */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
        className="absolute bottom-8 flex flex-col items-center gap-1"
      >
        <span className="text-xs text-white/30">Создано каналом</span>
        <a 
          href="https://t.me/ink_and_blood" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-white/70"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
          Чернила и Кровь
        </a>
      </motion.div>
    </main>
  );
}
