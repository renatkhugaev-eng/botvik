"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api";
import { haptic } from "@/lib/haptic";
import { AvatarWithFrame } from "./AvatarWithFrame";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

interface InventoryItem {
  id: number;
  slug: string;
  type: string;
  title: string;
  description: string | null;
  imageUrl: string;
  rarity: Rarity;
  acquiredAt: string;
  equipped: boolean;
}

interface InventoryResponse {
  ok: boolean;
  items: InventoryItem[];
  stats: {
    total: number;
    frames: number;
    equipped: number | null;
  };
  equippedFrameId: number | null;
}

interface InventorySectionProps {
  photoUrl: string | null;
  firstName: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const RARITY_CONFIG: Record<Rarity, { label: string; color: string; bg: string; border: string }> = {
  COMMON: { label: "Обычная", color: "text-gray-400", bg: "bg-gray-500/20", border: "border-gray-500/30" },
  RARE: { label: "Редкая", color: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" },
  EPIC: { label: "Эпическая", color: "text-purple-400", bg: "bg-purple-500/20", border: "border-purple-500/30" },
  LEGENDARY: { label: "Легендарная", color: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/30" },
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function InventorySection({ photoUrl, firstName }: InventorySectionProps) {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<number | null>(null);
  const [equippedFrameId, setEquippedFrameId] = useState<number | null>(null);

  // ═══ Load inventory ═══
  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth("/api/inventory");
      if (!res.ok) throw new Error("Failed to load inventory");
      
      const data: InventoryResponse = await res.json();
      setItems(data.items);
      setEquippedFrameId(data.equippedFrameId);
      setError(null);
    } catch (err) {
      console.error("[inventory] Failed to load:", err);
      setError("Не удалось загрузить инвентарь");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // ═══ Equip/Unequip item ═══
  const handleEquip = async (item: InventoryItem) => {
    if (equipping) return;

    haptic.light();
    setEquipping(item.id);

    try {
      const newItemId = item.equipped ? null : item.id;
      
      const res = await fetchWithAuth("/api/shop/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: newItemId }),
      });

      if (!res.ok) {
        throw new Error("Equip failed");
      }

      // Обновляем локальное состояние
      setItems(prev => prev.map(i => ({
        ...i,
        equipped: i.id === newItemId,
      })));
      setEquippedFrameId(newItemId);

      haptic.success();
    } catch (err) {
      console.error("[inventory] Equip failed:", err);
      haptic.error();
    } finally {
      setEquipping(null);
    }
  };

  // ═══ Get equipped frame URL ═══
  const equippedFrame = items.find(i => i.id === equippedFrameId);
  const fallbackLetter = firstName?.[0]?.toUpperCase() || "U";

  // ═══ RENDER ═══
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-violet-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <span className="text-4xl mb-2">😔</span>
        <p className="text-slate-500 text-sm">{error}</p>
        <button
          onClick={loadInventory}
          className="mt-4 px-4 py-2 bg-violet-500 text-white rounded-xl text-sm font-medium"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <span className="text-6xl mb-4">📦</span>
        <p className="text-slate-600 font-semibold">Инвентарь пуст</p>
        <p className="text-slate-400 text-sm mt-1">Купи рамки в магазине!</p>
        <button
          onClick={() => {
            haptic.medium();
            router.push("/miniapp/shop");
          }}
          className="mt-4 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-500/25 active:scale-95 transition-transform"
        >
          🛒 Перейти в магазин
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Preview текущей рамки */}
      <div className="flex items-center justify-center py-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-2xl">
        <div className="text-center">
          <AvatarWithFrame
            photoUrl={photoUrl}
            frameUrl={equippedFrame?.imageUrl}
            size={80}
            fallbackLetter={fallbackLetter}
          />
          <p className="mt-3 text-sm font-medium text-slate-600">
            {equippedFrame ? equippedFrame.title : "Без рамки"}
          </p>
          {equippedFrame && (
            <button
              onClick={() => handleEquip(equippedFrame)}
              disabled={equipping !== null}
              className="mt-2 px-3 py-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Снять рамку
            </button>
          )}
        </div>
      </div>

      {/* Статистика */}
      <div className="flex justify-center gap-6 py-2">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-800">{items.length}</p>
          <p className="text-xs text-slate-400">Всего</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-violet-600">
            {items.filter(i => i.type === "FRAME").length}
          </p>
          <p className="text-xs text-slate-400">Рамок</p>
        </div>
      </div>

      {/* Сетка предметов */}
      <div className="grid grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {items.map((item) => {
            const rarity = RARITY_CONFIG[item.rarity];
            const isEquipped = item.id === equippedFrameId;
            
            return (
              <motion.button
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => handleEquip(item)}
                disabled={equipping === item.id}
                className={`relative rounded-2xl p-3 border-2 transition-all group ${
                  isEquipped 
                    ? "border-green-500 bg-green-500/10" 
                    : `${rarity.border} ${rarity.bg} hover:scale-105`
                }`}
              >
                {/* Equipped badge with hover hint */}
                {isEquipped && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 group-hover:bg-red-500 rounded-full flex items-center justify-center transition-colors">
                    <span className="text-white text-xs group-hover:hidden">✓</span>
                    <span className="text-white text-xs hidden group-hover:block">✕</span>
                  </div>
                )}

                {/* Preview */}
                <div className="flex justify-center mb-2">
                  <AvatarWithFrame
                    photoUrl={photoUrl}
                    frameUrl={item.imageUrl}
                    size={50}
                    fallbackLetter={fallbackLetter}
                  />
                </div>

                {/* Title */}
                <p className="text-[11px] font-medium text-slate-700 truncate text-center">
                  {item.title}
                </p>

                {/* Rarity */}
                <p className={`text-[9px] font-bold ${rarity.color} text-center mt-0.5`}>
                  {rarity.label}
                </p>

                {/* Loading */}
                {equipping === item.id && (
                  <div className="absolute inset-0 bg-white/50 rounded-2xl flex items-center justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                  </div>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
