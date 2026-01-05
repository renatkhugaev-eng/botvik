"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  TextInput,
  Button,
  Spinner,
  Card,
} from "flowbite-react";
import {
  HiChartPie,
  HiCollection,
  HiUsers,
  HiChartBar,
  HiLogout,
  HiMenu,
  HiX,
  HiLockClosed,
} from "react-icons/hi";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Override global styles that block scrolling (set for Telegram Mini App)
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    
    // Save original styles
    const originalHtmlStyle = html.style.cssText;
    const originalBodyStyle = body.style.cssText;
    
    // Override for admin
    html.style.cssText = "height: auto; overflow: auto; position: static;";
    body.style.cssText = "height: auto; overflow: auto; position: static; min-height: 100vh;";
    
    return () => {
      // Restore on unmount (when leaving admin)
      html.style.cssText = originalHtmlStyle;
      body.style.cssText = originalBodyStyle;
    };
  }, []);

  // Check auth status via API (cookies handled by browser)
  const checkAuth = useCallback(async () => {
    try {
      // Make a request to check if we have a valid session
      // The HttpOnly cookie will be sent automatically
      const res = await fetch("/api/admin/stats", {
        method: "GET",
        credentials: "include", // Important: include cookies
      });
      
      if (res.ok) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
      }
    } catch {
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
        credentials: "include", // Important: receive and store cookies
      });

      if (res.ok) {
        // Cookie is set automatically by the server response
        // No need to store anything in localStorage (more secure!)
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
    // Server will clear the HttpOnly cookie
    await fetch("/api/admin/login", { 
      method: "DELETE",
      credentials: "include",
    });
    setAuthorized(false);
  };

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: HiChartPie },
    { href: "/admin/quizzes", label: "Квизы", icon: HiCollection },
    { href: "/admin/users", label: "Пользователи", icon: HiUsers },
    { href: "/admin/stats", label: "Статистика", icon: HiChartBar },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="xl" color="purple" />
          <p className="mt-4 text-gray-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-gray-800 border-gray-700">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <HiLockClosed className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Админ-панель</h1>
            <p className="text-gray-400">Введите пароль для входа</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <TextInput
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(false);
                }}
                placeholder="Пароль"
                color={passwordError ? "failure" : "gray"}
                disabled={submitting}
                sizing="lg"
              />
              {passwordError && (
                <p className="mt-2 text-sm text-red-500">Неверный пароль</p>
              )}
            </div>
            
            <Button
              type="submit"
              disabled={submitting}
              color="purple"
              className="w-full"
              size="lg"
            >
              {submitting ? <Spinner size="sm" className="mr-2" /> : null}
              {submitting ? "Проверка..." : "Войти"}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <Link
              href="/miniapp"
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              ← Вернуться в приложение
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 dark">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-gray-400 hover:text-white"
        >
          <HiMenu className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          🎯 Admin
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
        fixed top-0 left-0 z-50 h-full w-72 bg-gray-800 border-r border-gray-700
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:w-64
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              🎯 True Crime Admin
            </h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 text-gray-400 hover:text-white"
            >
              <HiX className="w-6 h-6" />
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
                          ? "bg-purple-600 text-white shadow-lg shadow-purple-500/25"
                          : "text-gray-400 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-700">
            <Button
              onClick={handleLogout}
              color="gray"
              className="w-full"
            >
              <HiLogout className="w-5 h-5 mr-2" />
              Выйти
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 pt-16 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8 pb-24">
          {children}
        </div>
      </main>
    </div>
  );
}
