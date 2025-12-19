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
// DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

const RARITY_STYLES: Record<Rarity, {
  label: string;
  gradient: string;
  glow: string;
  text: string;
  badge: string;
}> = {
  COMMON: {
    label: "Обычная",
    gradient: "from-slate-500/20 to-slate-600/10",
    glow: "shadow-slate-500/0",
    text: "text-slate-400",
    badge: "bg-slate-500/20 text-slate-300",
  },
  RARE: {
    label: "Редкая",
    gradient: "from-blue-500/20 to-cyan-500/10",
    glow: "shadow-blue-500/20",
    text: "text-blue-400",
    badge: "bg-blue-500/20 text-blue-300",
  },
  EPIC: {
    label: "Эпическая",
    gradient: "from-violet-500/20 to-purple-500/10",
    glow: "shadow-violet-500/30",
    text: "text-violet-400",
    badge: "bg-violet-500/20 text-violet-300",
  },
  LEGENDARY: {
    label: "Легендарная",
    gradient: "from-amber-500/20 via-orange-500/15 to-yellow-500/10",
    glow: "shadow-amber-500/40",
    text: "text-amber-400",
    badge: "bg-gradient-to-r from-amber-500/30 to-orange-500/20 text-amber-300",
  },
};

const FILTERS: { value: Rarity | "ALL"; label: string; icon: string }[] = [
  { value: "ALL", label: "Все", icon: "✨" },
  { value: "LEGENDARY", label: "Легенда", icon: "👑" },
  { value: "EPIC", label: "Эпик", icon: "💎" },
  { value: "RARE", label: "Редкие", icon: "💫" },
  { value: "COMMON", label: "Обычные", icon: "○" },
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
  const userName = session.status === "ready" ? (session.user.firstName || session.user.username || "U") : "U";

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

      if (data.free) {
        haptic.success();
        await loadItems();
        return;
      }

      if (data.invoiceUrl) {
        const tg = window.Telegram?.WebApp;
        
        if (tg?.openInvoice) {
          tg.openInvoice(data.invoiceUrl, (status) => {
            if (status === "paid") {
              haptic.success();
              setTimeout(() => loadItems(), 1500);
            } else if (status === "failed") {
              haptic.error();
            }
            setPurchasing(null);
          });
          return;
        } else {
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

      if (!res.ok) throw new Error("Equip failed");

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

  const filteredItems = items.filter(
    item => filter === "ALL" || item.rarity === filter
  );

  const equippedFrame = items.find(i => i.id === equippedFrameId);
  const ownedCount = items.filter(i => i.owned).length;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* ═══ Ambient Background ═══ */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-amber-600/5 rounded-full blur-[80px]" />
      </div>

      {/* ═══ Header ═══ */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { haptic.light(); router.back(); }}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>
          
          <h1 className="text-base font-semibold tracking-tight">Магазин</h1>
          
          <div className="w-10 h-10 flex items-center justify-center">
            <span className="text-lg">✨</span>
          </div>
        </div>
      </motion.header>

      {/* ═══ Hero Preview Section ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative px-4 pt-6 pb-4"
      >
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 p-6">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-blue-500/10 pointer-events-none" />
          
          <div className="relative flex items-center gap-5">
            {/* Avatar Preview */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/30 to-blue-500/30 rounded-full blur-xl scale-110" />
              <AvatarWithFrame
                photoUrl={photoUrl}
                frameUrl={equippedFrame?.imageUrl}
                size={72}
                fallbackLetter={userName[0]}
              />
            </motion.div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-1">
                Твой образ
              </p>
              <h2 className="text-lg font-bold text-white truncate">
                {equippedFrame?.title || "Без рамки"}
              </h2>
              <p className="text-white/40 text-sm mt-0.5">
                Собрано {ownedCount} из {items.length}
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ═══ Filter Pills ═══ */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="px-4 pb-4"
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
          {FILTERS.map((f, i) => {
            const isActive = filter === f.value;
            return (
              <motion.button
                key={f.value}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                onClick={() => { haptic.light(); setFilter(f.value); }}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                  isActive
                    ? "bg-white text-black shadow-lg shadow-white/20"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                }`}
              >
                <span className="text-sm">{f.icon}</span>
                <span>{f.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeFilter"
                    className="absolute inset-0 rounded-full bg-white -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      {/* ═══ Content Grid ═══ */}
      <section className="px-4 pb-24">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className="aspect-[3/4] rounded-2xl bg-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <span className="text-2xl">😔</span>
            </div>
            <p className="text-white/50 mb-4">{error}</p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={loadItems}
              className="px-5 py-2.5 bg-white/10 rounded-xl text-sm font-medium hover:bg-white/15 transition-colors"
            >
              Повторить
            </motion.button>
          </motion.div>
        ) : filteredItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <span className="text-2xl">🔍</span>
            </div>
            <p className="text-white/40 text-center">
              {filter === "ALL" ? "Магазин пуст" : "Нет товаров в этой категории"}
            </p>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item, index) => (
                <ShopItemCard
                  key={item.id}
                  item={item}
                  index={index}
                  photoUrl={photoUrl}
                  userName={userName}
                  purchasing={purchasing === item.id}
                  equipping={equipping === item.id}
                  onPurchase={() => handlePurchase(item)}
                  onEquip={() => handleEquip(item)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHOP ITEM CARD — Modern Glass Design
// ═══════════════════════════════════════════════════════════════════════════

interface ShopItemCardProps {
  item: ShopItem;
  index: number;
  photoUrl: string | null;
  userName: string;
  purchasing: boolean;
  equipping: boolean;
  onPurchase: () => void;
  onEquip: () => void;
}

function ShopItemCard({ 
  item, 
  index, 
  photoUrl, 
  userName,
  purchasing, 
  equipping, 
  onPurchase, 
  onEquip 
}: ShopItemCardProps) {
  const style = RARITY_STYLES[item.rarity];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileTap={{ scale: 0.98 }}
      className={`group relative rounded-2xl overflow-hidden bg-gradient-to-br ${style.gradient} border border-white/10 shadow-lg ${style.glow}`}
    >
      {/* Shine effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Top badges */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between z-10">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold backdrop-blur-sm ${style.badge}`}>
          {style.label}
        </span>
        
        {item.owned && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 backdrop-blur-sm"
          >
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </motion.span>
        )}
      </div>

      {/* Avatar Preview */}
      <div className="flex items-center justify-center pt-10 pb-4 px-4">
        <motion.div
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="relative"
        >
          {/* Glow behind avatar */}
          {item.rarity === "LEGENDARY" && (
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/40 to-orange-500/20 rounded-full blur-xl scale-125" />
          )}
          {item.rarity === "EPIC" && (
            <div className="absolute inset-0 bg-violet-500/30 rounded-full blur-lg scale-110" />
          )}
          <AvatarWithFrame
            photoUrl={photoUrl}
            frameUrl={item.imageUrl}
            size={72}
            fallbackLetter={userName[0]}
          />
        </motion.div>
      </div>

      {/* Info Section */}
      <div className="px-3 pb-3">
        <h3 className="font-semibold text-sm text-white/90 truncate leading-tight">
          {item.title}
        </h3>
        {item.description && (
          <p className="text-[11px] text-white/40 truncate mt-0.5 leading-tight">
            {item.description}
          </p>
        )}

        {/* Action Button */}
        <div className="mt-3">
          {item.owned ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onEquip}
              disabled={equipping}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                item.equipped
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                  : "bg-white/10 text-white/80 hover:bg-white/15"
              }`}
            >
              {equipping ? (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  •••
                </motion.span>
              ) : item.equipped ? (
                <span className="flex items-center justify-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Надето
                </span>
              ) : (
                "Надеть"
              )}
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onPurchase}
              disabled={purchasing}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow"
            >
              {purchasing ? (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  •••
                </motion.span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <span className="text-amber-300">⭐</span>
                  <span>{item.priceStars}</span>
                </span>
              )}
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
