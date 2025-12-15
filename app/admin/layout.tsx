"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

// Admin password - change this to your secure password!
const ADMIN_PASSWORD = "truecrime2024";

// Admin Telegram IDs (for display purposes)
const ADMIN_IDS = ["dev-mock", "5731136459"];

type AdminUser = {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string | null;
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  useEffect(() => {
    // Check if already authorized via localStorage
    const savedAuth = localStorage.getItem("admin_authorized");
    if (savedAuth === "true") {
      setAuthorized(true);
      setUser({
        id: 1,
        telegramId: "5731136459",
        username: "admin",
        firstName: "Admin",
      });
    }
    setLoading(false);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === ADMIN_PASSWORD) {
      setAuthorized(true);
      setPasswordError(false);
      localStorage.setItem("admin_authorized", "true");
      setUser({
        id: 1,
        telegramId: "5731136459",
        username: "admin",
        firstName: "Admin",
      });
    } else {
      setPasswordError(true);
      setPassword("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_authorized");
    setAuthorized(false);
    setUser(null);
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 border border-slate-700">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🔐</div>
            <h1 className="text-2xl font-bold text-white mb-2">Админ-панель</h1>
            <p className="text-slate-400">Введите пароль для входа</p>
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
                className={`w-full px-4 py-3 bg-slate-700 border rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-violet-500 ${
                  passwordError ? "border-red-500" : "border-slate-600"
                }`}
                autoFocus
              />
              {passwordError && (
                <p className="text-red-400 text-sm mt-2">Неверный пароль</p>
              )}
            </div>
            
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/25"
            >
              Войти
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
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            True Crime Admin
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/admin" && pathname.startsWith(item.href));
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
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

        {/* User info + Logout */}
        <div className="p-4 border-t border-slate-700 space-y-3">
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-700/50 rounded-xl">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
              {user?.firstName?.[0] || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium truncate">
                {user?.firstName || "Admin"}
              </div>
              <div className="text-xs text-slate-400 truncate">
                Администратор
              </div>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
          >
            <span>🚪</span> Выйти
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
