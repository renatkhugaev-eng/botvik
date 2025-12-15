"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Check if already authorized via localStorage token
    const savedToken = localStorage.getItem("admin_token");
    if (savedToken) {
      try {
        const decoded = JSON.parse(atob(savedToken));
        if (decoded.authorized && decoded.expires > Date.now()) {
          setAuthorized(true);
        } else {
          localStorage.removeItem("admin_token");
        }
      } catch {
        localStorage.removeItem("admin_token");
      }
    }
    setLoading(false);
  }, []);

  // Close sidebar when route changes (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setPasswordError(false);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("admin_token", data.token);
        setAuthorized(true);
      } else {
        setPasswordError(true);
        setPassword("");
      }
    } catch {
      setPasswordError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("admin_token");
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthorized(false);
  };

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: "📊" },
    { href: "/admin/quizzes", label: "Квизы", icon: "🎮" },
    { href: "/admin/users", label: "Пользователи", icon: "👥" },
    { href: "/admin/stats", label: "Статистика", icon: "📈" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-slate-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-6 sm:p-8 border border-slate-700">
          <div className="text-center mb-6 sm:mb-8">
            <div className="text-5xl sm:text-6xl mb-4">🔐</div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Админ-панель</h1>
            <p className="text-slate-400 text-sm sm:text-base">Введите пароль для входа</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(false);
                }}
                placeholder="Пароль"
                className={`w-full px-4 py-3 bg-slate-700 border rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-violet-500 text-base ${
                  passwordError ? "border-red-500" : "border-slate-600"
                }`}
                autoFocus
                disabled={submitting}
              />
              {passwordError && (
                <p className="text-red-400 text-sm mt-2">Неверный пароль</p>
              )}
            </div>
            
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/25"
            >
              {submitting ? "Проверка..." : "Войти"}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <Link
              href="/miniapp"
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              ← Вернуться в приложение
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-slate-400 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span>🎯</span> Admin
        </h1>
        <div className="w-10" />
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-72 bg-slate-800 border-r border-slate-700 flex flex-col
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:w-64
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Logo */}
        <div className="p-4 sm:p-6 border-b border-slate-700 flex items-center justify-between">
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <span className="text-xl sm:text-2xl">🎯</span>
            True Crime Admin
          </h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/admin" && pathname.startsWith(item.href));
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? "bg-violet-600 text-white shadow-lg shadow-violet-500/25"
                        : "text-slate-400 hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
          >
            <span>🚪</span> Выйти
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0 overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8 pb-24">
          {children}
        </div>
      </main>
    </div>
  );
}
