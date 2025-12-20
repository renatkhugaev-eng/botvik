"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

// Тип фильтра расширен для "OWNED"
type FilterValue = Rarity | "ALL" | "OWNED";

const FILTERS: { value: FilterValue; label: string; icon: string }[] = [
  { value: "ALL", label: "Все", icon: "✨" },
  { value: "OWNED", label: "Мои", icon: "💎" },
  { value: "LEGENDARY", label: "Легенда", icon: "👑" },
  { value: "EPIC", label: "Эпик", icon: "💜" },
  { value: "RARE", label: "Редкие", icon: "💫" },
  { value: "COMMON", label: "Обычные", icon: "○" },
];

// Получить цвет свечения по редкости
const getRarityGlow = (rarity: Rarity): string => {
  switch (rarity) {
    case "LEGENDARY":
      return "from-amber-500/40 via-orange-500/30 to-yellow-500/20";
    case "EPIC":
      return "from-violet-500/40 to-purple-500/30";
    case "RARE":
      return "from-blue-500/30 to-cyan-500/20";
    case "COMMON":
    default:
      return "from-violet-500/30 to-blue-500/20";
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SHOP PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function ShopPage() {
  const router = useRouter();
  const session = useMiniAppSession();
  
  // Ref для предотвращения утечки памяти при unmount
  const mountedRef = useRef(true);
  
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("ALL");
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [equipping, setEquipping] = useState<number | null>(null);
  const [equippedFrameId, setEquippedFrameId] = useState<number | null>(null);

  const photoUrl = session.status === "ready" ? session.user.photoUrl : null;
  const userName = session.status === "ready" ? (session.user.firstName || session.user.username || "U") : "U";

  // Cleanup при unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ═══ Load shop items ═══
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth("/api/shop");
      if (!res.ok) throw new Error("Failed to load shop");
      
      const data: ShopResponse = await res.json();
      
      // Проверяем что компонент ещё смонтирован
      if (!mountedRef.current) return;
      
      setItems(data.items);
      setEquippedFrameId(data.equippedFrameId);
      setError(null);
    } catch (err) {
      console.error("[shop] Failed to load:", err);
      if (mountedRef.current) {
        setError("Не удалось загрузить магазин");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
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
        setPurchasing(null);
        return;
      }

      if (data.invoiceUrl) {
        const tg = window.Telegram?.WebApp;
        
        if (tg?.openInvoice) {
          // Callback управляет состоянием — не используем finally
          tg.openInvoice(data.invoiceUrl, (status) => {
            if (status === "paid") {
              haptic.success();
              setTimeout(() => loadItems(), 1500);
            } else if (status === "failed") {
              haptic.error();
            }
            setPurchasing(null);
          });
          return; // Важно: не попадаем в finally
        } else {
          // Dev mode — показываем ссылку
          console.warn("[shop] Running in dev mode, openInvoice unavailable");
          alert(`Dev mode: откройте ссылку в Telegram\n${data.invoiceUrl}`);
          setPurchasing(null);
          return;
        }
      }

      // Если нет invoiceUrl и не free — что-то пошло не так
      setPurchasing(null);

    } catch (err) {
      console.error("[shop] Purchase failed:", err);
      haptic.error();
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

  const filteredItems = items.filter(item => {
    if (filter === "ALL") return true;
    if (filter === "OWNED") return item.owned;
    return item.rarity === filter;
  });

  const equippedFrame = items.find(i => i.id === equippedFrameId);
  const ownedCount = items.filter(i => i.owned).length;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* ═══ Ambient Background (GPU-ускорен через transform) ═══ */}
      <div 
        className="fixed inset-0 overflow-hidden pointer-events-none" 
        style={{ transform: 'translateZ(0)' }}
        aria-hidden="true"
      >
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-violet-600/8 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-blue-600/8 rounded-full blur-[80px]" />
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
              {/* Динамическое свечение по редкости рамки */}
              <div 
                className={`absolute inset-0 bg-gradient-to-br ${
                  equippedFrame ? getRarityGlow(equippedFrame.rarity) : "from-violet-500/20 to-blue-500/20"
                } rounded-full blur-xl scale-125 transition-all duration-500`} 
              />
              {loading ? (
                <div 
                  className="rounded-full bg-white/10 animate-pulse" 
                  style={{ width: 72, height: 72 }}
                />
              ) : (
                <AvatarWithFrame
                  photoUrl={photoUrl}
                  frameUrl={equippedFrame?.imageUrl}
                  size={72}
                  fallbackLetter={userName[0]}
                />
              )}
            </motion.div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-1">
                Твой образ
              </p>
              <h2 className="text-lg font-bold text-white truncate">
                {equippedFrame?.title || "Без рамки"}
              </h2>
              {!loading && items.length > 0 && (
                <p className="text-white/40 text-sm mt-0.5">
                  Собрано {ownedCount} из {items.length}
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* ═══ Filter Pills с fade-эффектом на краях ═══ */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="px-4 pb-4"
      >
        <div className="relative">
          {/* Fade-эффект слева */}
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#0a0a0f] to-transparent z-10 pointer-events-none" />
          {/* Fade-эффект справа */}
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#0a0a0f] to-transparent z-10 pointer-events-none" />
          
          <div 
            className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 px-2"
            role="tablist"
            aria-label="Фильтр по редкости"
          >
            {FILTERS.map((f, i) => {
              const isActive = filter === f.value;
              // Количество товаров для бейджа на фильтре
              const count = f.value === "ALL" 
                ? items.length 
                : f.value === "OWNED"
                  ? items.filter(i => i.owned).length
                  : items.filter(i => i.rarity === f.value).length;
              
              return (
                <motion.button
                  key={f.value}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                  onClick={() => { haptic.light(); setFilter(f.value); }}
                  aria-selected={isActive}
                  role="tab"
                  className={`relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                    isActive
                      ? "bg-white text-black shadow-lg shadow-white/20"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                  }`}
                >
                  <span className="text-sm">{f.icon}</span>
                  <span>{f.label}</span>
                  {/* Счётчик товаров */}
                  {!loading && count > 0 && (
                    <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive ? "bg-black/10" : "bg-white/10"
                    }`}>
                      {count}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
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
                className="aspect-[3/4] rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/5 overflow-hidden"
              >
                {/* Skeleton content structure */}
                <div className="h-full flex flex-col p-3">
                  {/* Top badge placeholder */}
                  <div className="flex justify-between mb-2">
                    <div className="h-4 w-16 rounded bg-white/10 animate-pulse" />
                  </div>
                  {/* Avatar placeholder */}
                  <div className="flex-1 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-white/10 animate-pulse" />
                  </div>
                  {/* Text placeholders */}
                  <div className="space-y-2 mt-2">
                    <div className="h-3.5 w-3/4 rounded bg-white/10 animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-white/5 animate-pulse" />
                  </div>
                  {/* Button placeholder */}
                  <div className="h-8 w-full rounded-xl bg-white/10 animate-pulse mt-2.5" />
                </div>
              </motion.div>
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
              <span className="text-2xl">{filter === "OWNED" ? "🛒" : "🔍"}</span>
            </div>
            <p className="text-white/40 text-center max-w-[200px]">
              {filter === "ALL" 
                ? "Магазин пуст" 
                : filter === "OWNED"
                  ? "У вас пока нет рамок. Самое время купить первую!"
                  : "Нет товаров в этой категории"}
            </p>
            {filter === "OWNED" && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { haptic.light(); setFilter("ALL"); }}
                className="mt-4 px-4 py-2 bg-white/10 rounded-xl text-sm font-medium hover:bg-white/15 transition-colors"
              >
                Смотреть все
              </motion.button>
            )}
          </motion.div>
        ) : (
          <div role="list" aria-label="Список товаров">
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
          </div>
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
  const isFree = item.priceStars === 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileTap={{ scale: 0.98 }}
      // Фиксированный aspect ratio для предотвращения layout shift
      className={`group relative aspect-[3/4] rounded-2xl overflow-hidden bg-gradient-to-br ${style.gradient} border border-white/10 shadow-lg ${style.glow} flex flex-col`}
    >
      {/* Shine effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Top badges — улучшенный layout с max-width */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-1.5 z-10">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold backdrop-blur-sm shrink-0 ${style.badge}`}>
          {style.label}
        </span>
        
        {item.owned && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 backdrop-blur-sm shrink-0"
          >
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </motion.span>
        )}
      </div>

      {/* Avatar Preview — фиксированный размер для консистентного центрирования */}
      <div className="flex-1 flex items-center justify-center">
        {/* Фиксированный контейнер для идеального центрирования во всех карточках */}
        <div 
          className="relative flex items-center justify-center"
          style={{ 
            width: 68 * 1.85, // Фиксированный размер = размер AvatarWithFrame с рамкой
            height: 68 * 1.85,
          }}
        >
          {/* Glow — центрирован относительно контейнера */}
          <div 
            className={`absolute inset-0 bg-gradient-to-br ${getRarityGlow(item.rarity)} rounded-full blur-xl scale-110`}
          />
          {/* Avatar с рамкой — абсолютно центрирован */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <AvatarWithFrame
              photoUrl={photoUrl}
              frameUrl={item.imageUrl}
              size={68}
              fallbackLetter={userName[0]}
            />
          </motion.div>
        </div>
      </div>

      {/* Info Section — унифицированный padding, улучшенное описание */}
      <div className="px-3 pb-3 pt-2">
        <h3 className="font-semibold text-sm text-white/90 truncate leading-tight">
          {item.title}
        </h3>
        {/* Описание с 2 строками и tooltip */}
        {item.description && (
          <p 
            className="text-[11px] text-white/40 mt-0.5 leading-tight line-clamp-2"
            title={item.description}
          >
            {item.description}
          </p>
        )}

        {/* Action Button */}
        <div className="mt-2.5">
          {item.owned ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onEquip}
              disabled={equipping}
              aria-label={item.equipped ? "Снять рамку" : "Надеть рамку"}
              className={`w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
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
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
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
              aria-label={isFree ? "Получить бесплатно" : `Купить за ${item.priceStars} звёзд`}
              className={`w-full py-2 rounded-xl text-xs font-semibold shadow-lg transition-shadow ${
                isFree 
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-500/25 hover:shadow-emerald-500/40"
                  : "bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-violet-500/25 hover:shadow-violet-500/40"
              }`}
            >
              {purchasing ? (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  •••
                </motion.span>
              ) : isFree ? (
                <span className="flex items-center justify-center gap-1.5">
                  <span>🎁</span>
                  <span>Бесплатно</span>
                </span>
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
