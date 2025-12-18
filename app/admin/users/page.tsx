"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Card,
  TextInput,
  Button,
  Spinner,
  Toast,
  ToastToggle,
  Avatar,
  Badge,
} from "flowbite-react";
import { HiSearch, HiLightningBolt, HiCheck } from "react-icons/hi";

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
      const data = await api.post<{ message: string }>(`/api/admin/users/${userId}/reset-energy`);
      setToast(data.message);
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
        const data = await api.get<{ users: User[] }>("/api/admin/users");
        setUsers(data.users || []);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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
          <p className="text-gray-400 text-sm">Всего: {users.length}</p>
        </div>
        <TextInput
          icon={HiSearch}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
          className="w-full sm:w-64"
          color="gray"
          />
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="xl" color="purple" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card className="bg-gray-800 border-gray-700 text-center">
          <p className="text-gray-400">
            {search ? "Пользователи не найдены" : "Нет пользователей"}
          </p>
        </Card>
      ) : (
        <div className="space-y-3 pb-8">
          {filteredUsers.map((user) => (
            <Card key={user.id} className="bg-gray-800 border-gray-700">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <Avatar
                  placeholderInitials={user.firstName?.[0] || user.username?.[0] || "?"}
                  rounded
                  size="md"
                  color="purple"
                />
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-white font-semibold truncate">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-400">
                        @{user.username || "—"}
                      </div>
                    </div>
                    
                    {/* Reset Button */}
                    <Button
                      size="sm"
                      color="warning"
                      onClick={() => resetEnergy(user.id, user.firstName || user.username || "Пользователь")}
                      disabled={resettingId === user.id}
                    >
                      {resettingId === user.id ? (
                        <Spinner size="sm" />
                      ) : (
                        <HiLightningBolt className="w-4 h-4 mr-1" />
                      )}
                      <span className="hidden sm:inline">Сброс</span>
                    </Button>
                  </div>
                  
                  {/* Stats */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Badge color="warning">
                      {user.xp.toLocaleString()} XP
                    </Badge>
                    <Badge color="gray">
                      {user._count.sessions} игр
                    </Badge>
                    <span className="text-gray-500 text-xs">
                      {new Date(user.createdAt).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <Toast>
            <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-500">
              <HiCheck className="h-5 w-5" />
            </div>
            <div className="ml-3 text-sm font-normal text-white">{toast}</div>
            <ToastToggle onDismiss={() => setToast(null)} />
          </Toast>
        </div>
      )}
    </div>
  );
}
