"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMiniAppSession } from "../layout";
import { haptic } from "@/lib/haptic";
import { fetchWithAuth } from "@/lib/api";
import { AvatarWithFrame } from "@/components/AvatarWithFrame";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

interface ShopItem {
  id: number;
  slug: string;
  type: string;
  title: string;
  description: string | null;
  imageUrl: string;
  previewUrl: string | null;
  priceStars: number;
  rarity: Rarity;
  owned: boolean;
  equipped: boolean;
}

interface ShopResponse {
  ok: boolean;
  items: ShopItem[];
  equippedFrameId: number | null;
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

const FILTER_OPTIONS: { value: Rarity | "ALL"; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "LEGENDARY", label: "🌟 Легендарные" },
  { value: "EPIC", label: "💜 Эпические" },
  { value: "RARE", label: "💙 Редкие" },
  { value: "COMMON", label: "⚪ Обычные" },
];

// ═══════════════════════════════════════════════════════════════════════════
// SHOP PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function ShopPage() {
  const router = useRouter();
  const session = useMiniAppSession();
  
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Rarity | "ALL">("ALL");
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [equipping, setEquipping] = useState<number | null>(null);
  const [equippedFrameId, setEquippedFrameId] = useState<number | null>(null);

  const photoUrl = session.status === "ready" ? session.user.photoUrl : null;

  // ═══ Load shop items ═══
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth("/api/shop");
      if (!res.ok) throw new Error("Failed to load shop");
      
      const data: ShopResponse = await res.json();
      setItems(data.items);
      setEquippedFrameId(data.equippedFrameId);
      setError(null);
    } catch (err) {
      console.error("[shop] Failed to load:", err);
      setError("Не удалось загрузить магазин");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.status === "ready") {
      loadItems();
    }
  }, [session.status, loadItems]);

  // ═══ Purchase item ═══
  const handlePurchase = async (item: ShopItem) => {
    if (purchasing || item.owned) return;
    
    haptic.medium();
    setPurchasing(item.id);

    try {
      const res = await fetchWithAuth("/api/shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Purchase failed");
      }

      // Бесплатный товар — сразу обновляем UI
      if (data.free) {
        haptic.success();
        await loadItems();
        return;
      }

      // Платный товар — открываем через Telegram Mini App API
      if (data.invoiceUrl) {
        const tg = window.Telegram?.WebApp;
        
        if (tg?.openInvoice) {
          // Правильный способ — через Telegram Mini App API
          tg.openInvoice(data.invoiceUrl, (status) => {
            console.log("[shop] Payment status:", status);
            
            if (status === "paid") {
              haptic.success();
              loadItems(); // Обновляем список после успешной оплаты
            } else if (status === "failed") {
              haptic.error();
            }
            // status может быть: "paid", "cancelled", "failed", "pending"
            
            setPurchasing(null);
          });
          return; // Не сбрасываем purchasing здесь — сбросим в callback
        } else {
          // Fallback для браузера (dev mode)
          console.warn("[shop] openInvoice not available, using fallback");
          window.open(data.invoiceUrl, "_blank");
          setTimeout(() => loadItems(), 3000);
        }
      }

    } catch (err) {
      console.error("[shop] Purchase failed:", err);
      haptic.error();
    } finally {
      setPurchasing(null);
    }
  };

  // ═══ Equip/Unequip item ═══
  const handleEquip = async (item: ShopItem) => {
    if (equipping || !item.owned) return;

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
      console.error("[shop] Equip failed:", err);
      haptic.error();
    } finally {
      setEquipping(null);
    }
  };

  // ═══ Filter items ═══
  const filteredItems = items.filter(
    item => filter === "ALL" || item.rarity === filter
  );

  // ═══ Get equipped frame URL ═══
  const equippedFrame = items.find(i => i.id === equippedFrameId);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#1a1a2e]/95 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Back button */}
          <button
            onClick={() => { haptic.light(); router.back(); }}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors min-w-[70px]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Назад
          </button>
          
          {/* Center: Title */}
          <h1 className="text-lg font-bold flex-shrink-0">🛒 Магазин</h1>
          
          {/* Right: Preview equipped frame - уменьшенный размер */}
          <div className="min-w-[70px] flex justify-end">
            <AvatarWithFrame
              photoUrl={photoUrl}
              frameUrl={equippedFrame?.imageUrl}
              size={32}
              fallbackLetter="U"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { haptic.light(); setFilter(opt.value); }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                filter === opt.value
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-square rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={loadItems}
              className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
            >
              Повторить
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-white/50">
            {filter === "ALL" ? "Магазин пуст" : "Нет товаров в этой категории"}
          </div>
        ) : (
          <motion.div 
            className="grid grid-cols-2 gap-3"
            layout
          >
            <AnimatePresence mode="popLayout">
              {filteredItems.map(item => (
                <ShopItemCard
                  key={item.id}
                  item={item}
                  photoUrl={photoUrl}
                  purchasing={purchasing === item.id}
                  equipping={equipping === item.id}
                  onPurchase={() => handlePurchase(item)}
                  onEquip={() => handleEquip(item)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHOP ITEM CARD
// ═══════════════════════════════════════════════════════════════════════════

interface ShopItemCardProps {
  item: ShopItem;
  photoUrl: string | null;
  purchasing: boolean;
  equipping: boolean;
  onPurchase: () => void;
  onEquip: () => void;
}

function ShopItemCard({ item, photoUrl, purchasing, equipping, onPurchase, onEquip }: ShopItemCardProps) {
  const rarity = RARITY_CONFIG[item.rarity];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`relative rounded-2xl overflow-hidden border ${rarity.border} ${rarity.bg}`}
    >
      {/* Rarity badge */}
      <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${rarity.bg} ${rarity.color}`}>
        {rarity.label}
      </div>

      {/* Owned badge */}
      {item.owned && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400">
          ✓ Куплено
        </div>
      )}

      {/* Preview with frame */}
      <div className="flex items-center justify-center py-6 px-4">
        <AvatarWithFrame
          photoUrl={photoUrl}
          frameUrl={item.imageUrl}
          size={80}
          fallbackLetter="?"
        />
      </div>

      {/* Info */}
      <div className="px-3 pb-3">
        <h3 className="font-bold text-sm truncate">{item.title}</h3>
        {item.description && (
          <p className="text-[11px] text-white/50 truncate mt-0.5">{item.description}</p>
        )}

        {/* Action button */}
        <div className="mt-3">
          {item.owned ? (
            <button
              onClick={onEquip}
              disabled={equipping}
              className={`w-full py-2 rounded-xl text-sm font-bold transition-all ${
                item.equipped
                  ? "bg-green-500 text-white"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {equipping ? "..." : item.equipped ? "✓ Надето" : "Надеть"}
            </button>
          ) : (
            <button
              onClick={onPurchase}
              disabled={purchasing}
              className="w-full py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
            >
              {purchasing ? (
                "..."
              ) : (
                <>
                  <span>⭐</span>
                  <span>{item.priceStars}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
