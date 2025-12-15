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
    <div className="fixed bottom-20 left-4 right-4 sm:bottom-6 sm:right-6 sm:left-auto bg-green-500 text-white px-4 sm:px-6 py-3 rounded-xl shadow-lg shadow-green-500/30 z-50 text-center sm:text-left">
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
    if (!confirm(`Сбросить энергию для ${userName}?`)) {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Пользователи</h1>
          <p className="text-slate-400 text-sm">Всего: {users.length}</p>
        </div>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
        </div>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-slate-800 rounded-2xl p-8 text-center border border-slate-700">
          <p className="text-slate-400">
            {search ? "Пользователи не найдены" : "Нет пользователей"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="bg-slate-800 rounded-xl p-4 border border-slate-700"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {user.firstName?.[0] || user.username?.[0] || "?"}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-white font-semibold truncate">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-slate-400">
                        @{user.username || "—"}
                      </div>
                    </div>
                    
                    {/* Reset Button */}
                    <button
                      onClick={() => resetEnergy(user.id, user.firstName || user.username || "Пользователь")}
                      disabled={resettingId === user.id}
                      className="px-3 py-1.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 flex-shrink-0"
                    >
                      {resettingId === user.id ? (
                        <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>⚡</span>
                      )}
                      <span className="hidden sm:inline">Сброс</span>
                    </button>
                  </div>
                  
                  {/* Stats */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
                    <span className="text-amber-400 font-medium">
                      {user.xp.toLocaleString()} XP
                    </span>
                    <span className="text-slate-400">
                      {user._count.sessions} игр
                    </span>
                    <span className="text-slate-500 text-xs">
                      {new Date(user.createdAt).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toast notification */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
