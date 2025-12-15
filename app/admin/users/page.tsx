"use client";

import { useEffect, useState } from "react";

type User = {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  xp: number;
  createdAt: string;
  _count: {
    sessions: number;
  };
};

// Toast notification component
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg shadow-green-500/30 z-50 animate-pulse">
      ✅ {message}
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<number | null>(null);

  const resetEnergy = async (userId: number, userName: string) => {
    if (!confirm(`Сбросить энергию для ${userName}? Это удалит все сегодняшние сессии.`)) {
      return;
    }

    setResettingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-energy`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setToast(data.message);
      } else {
        alert("Ошибка сброса энергии");
      }
    } catch (error) {
      console.error("Failed to reset energy:", error);
      alert("Ошибка сброса энергии");
    } finally {
      setResettingId(null);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/admin/users");
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const filteredUsers = users.filter((user) => {
    const searchLower = search.toLowerCase();
    return (
      user.username?.toLowerCase().includes(searchLower) ||
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.telegramId.includes(search)
    );
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Пользователи</h1>
          <p className="text-slate-400">Всего: {users.length}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="w-64 pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              🔍
            </span>
          </div>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-slate-700 rounded-xl" />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-4 px-6 text-slate-400 font-medium">Пользователь</th>
                <th className="text-left py-4 px-6 text-slate-400 font-medium">Telegram ID</th>
                <th className="text-left py-4 px-6 text-slate-400 font-medium">XP</th>
                <th className="text-left py-4 px-6 text-slate-400 font-medium">Игр</th>
                <th className="text-left py-4 px-6 text-slate-400 font-medium">Регистрация</th>
                <th className="text-left py-4 px-6 text-slate-400 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    {search ? "Пользователи не найдены" : "Нет пользователей"}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                          {user.firstName?.[0] || user.username?.[0] || "?"}
                        </div>
                        <div>
                          <div className="text-white font-medium">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-slate-400">
                            @{user.username || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <code className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
                        {user.telegramId}
                      </code>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-amber-400 font-semibold">
                        {user.xp.toLocaleString()} XP
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-300">{user._count.sessions}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-400 text-sm">
                        {new Date(user.createdAt).toLocaleDateString("ru-RU")}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => resetEnergy(user.id, user.firstName || user.username || "Пользователь")}
                        disabled={resettingId === user.id}
                        className="px-3 py-1.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                        title="Сбросить энергию (удалить сегодняшние сессии)"
                      >
                        {resettingId === user.id ? (
                          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span>⚡</span>
                        )}
                        Сброс
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast notification */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

