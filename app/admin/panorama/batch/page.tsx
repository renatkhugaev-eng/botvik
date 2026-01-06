"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BATCH PANORAMA GENERATOR
 * Генерация нескольких миссий из списка готовых локаций
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const google: any;

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { 
  buildPanoramaGraph, 
  graphToSerializable,
  type BuildGraphOptions 
} from "@/lib/panorama-graph-builder";
import type { MissionThemeType } from "@/types/panorama-graph";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface LocationPreset {
  id: string;
  name: string;
  country: string;
  flag: string;
  coords: [number, number];
  theme: MissionThemeType;
  difficulty: "easy" | "medium" | "hard" | "extreme";
  clueCount: number;
  description: string;
  whyFits: string;
}

type GenerationStatus = "pending" | "scanning" | "generating" | "publishing" | "done" | "error";

interface LocationState extends LocationPreset {
  status: GenerationStatus;
  progress: number;
  error?: string;
  missionId?: string;
  graphNodes?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOP 10 LOCATIONS
// ═══════════════════════════════════════════════════════════════════════════

const TOP_10_LOCATIONS: LocationPreset[] = [
  {
    id: "tokyo-shibuya",
    name: "Токио, Сибуя",
    country: "Япония",
    flag: "🇯🇵",
    coords: [35.6594, 139.7006],
    theme: "yakuza",
    difficulty: "hard",
    clueCount: 5,
    description: "Неоновые улицы крупнейшего перекрёстка мира",
    whyFits: "Идеально для темы якудза — переулки, бары, неон",
  },
  {
    id: "venice-san-marco",
    name: "Венеция, Сан-Марко",
    country: "Италия",
    flag: "🇮🇹",
    coords: [45.4343, 12.3388],
    theme: "art-theft",
    difficulty: "medium",
    clueCount: 5,
    description: "Лабиринт каналов и мостов исторического центра",
    whyFits: "Кража Тициана — галереи, мосты, романтика",
  },
  {
    id: "las-vegas-strip",
    name: "Лас-Вегас, Стрип",
    country: "США",
    flag: "🇺🇸",
    coords: [36.1147, -115.1728],
    theme: "heist",
    difficulty: "hard",
    clueCount: 6,
    description: "Казино и отели знаменитой полосы",
    whyFits: "Идеальное ограбление — казино, фишки, планы",
  },
  {
    id: "hong-kong-mongkok",
    name: "Гонконг, Монгкок",
    country: "Гонконг",
    flag: "🇭🇰",
    coords: [22.3193, 114.1694],
    theme: "smuggling",
    difficulty: "hard",
    clueCount: 5,
    description: "Самый густонаселённый район мира — рынки и переулки",
    whyFits: "Контрабанда триад — рынки, тайники, неон",
  },
  {
    id: "london-soho",
    name: "Лондон, Сохо",
    country: "Великобритания",
    flag: "🇬🇧",
    coords: [51.5137, -0.1318],
    theme: "spy",
    difficulty: "medium",
    clueCount: 5,
    description: "Богемный район с секретами холодной войны",
    whyFits: "Шпионаж — конспиративные квартиры, кафе, тайники",
  },
  {
    id: "moscow-red-square",
    name: "Москва, Красная площадь",
    country: "Россия",
    flag: "🇷🇺",
    coords: [55.7539, 37.6208],
    theme: "corruption",
    difficulty: "hard",
    clueCount: 5,
    description: "Сердце России — Кремль, ГУМ, Собор Василия",
    whyFits: "Коррупция — власть, документы, встречи",
  },
  {
    id: "paris-montmartre",
    name: "Париж, Монмартр",
    country: "Франция",
    flag: "🇫🇷",
    coords: [48.8867, 2.3431],
    theme: "murder",
    difficulty: "medium",
    clueCount: 5,
    description: "Художественный холм с видом на весь Париж",
    whyFits: "Убийство — узкие улочки, кафе, тайны",
  },
  {
    id: "dubai-downtown",
    name: "Дубай, Downtown",
    country: "ОАЭ",
    flag: "🇦🇪",
    coords: [25.1972, 55.2744],
    theme: "kidnapping",
    difficulty: "hard",
    clueCount: 5,
    description: "Бурдж-Халифа и Dubai Mall — город будущего",
    whyFits: "Похищение миллиардера — роскошь, небоскрёбы",
  },
  {
    id: "amsterdam-canals",
    name: "Амстердам, Каналы",
    country: "Нидерланды",
    flag: "🇳🇱",
    coords: [52.3676, 4.9041],
    theme: "smuggling",
    difficulty: "medium",
    clueCount: 5,
    description: "Сеть каналов XVII века — мосты и домики",
    whyFits: "Контрабанда — лодки, склады, тайные маршруты",
  },
  {
    id: "barcelona-gothic",
    name: "Барселона, Готический квартал",
    country: "Испания",
    flag: "🇪🇸",
    coords: [41.3833, 2.1761],
    theme: "murder",
    difficulty: "hard",
    clueCount: 5,
    description: "Средневековые улочки в сердце Барселоны",
    whyFits: "Убийство — тени, лабиринт улиц, история",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function BatchPanoramaPage() {
  const router = useRouter();
  
  // State
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [locations, setLocations] = useState<LocationState[]>(
    TOP_10_LOCATIONS.map(loc => ({ ...loc, status: "pending", progress: 0 }))
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(TOP_10_LOCATIONS.map(l => l.id)));
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoPublish, setAutoPublish] = useState(true);
  
  // Scan settings
  const [maxDepth, setMaxDepth] = useState(40);
  const [maxNodes, setMaxNodes] = useState(200);
  
  // Stats
  const [stats, setStats] = useState({ total: 0, done: 0, errors: 0 });
  
  // Refs
  const abortRef = useRef(false);
  
  // ─── Toggle selection ───
  const toggleLocation = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);
  
  // ─── Select all / none ───
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(TOP_10_LOCATIONS.map(l => l.id)));
  }, []);
  
  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);
  
  // ─── Update location state ───
  const updateLocation = useCallback((id: string, update: Partial<LocationState>) => {
    setLocations(prev => prev.map(loc => 
      loc.id === id ? { ...loc, ...update } : loc
    ));
  }, []);
  
  // ─── Generate single mission ───
  const generateMission = useCallback(async (location: LocationState): Promise<boolean> => {
    if (abortRef.current) return false;
    
    try {
      // 1. SCANNING
      updateLocation(location.id, { status: "scanning", progress: 10 });
      
      const options: BuildGraphOptions = {
        maxDepth,
        maxNodes,
        onProgress: (scanned, total, depth) => {
          const progress = Math.min(10 + (scanned / Math.max(total, 1)) * 40, 50);
          updateLocation(location.id, { progress });
        },
      };
      
      const graph = await buildPanoramaGraph(location.coords, options);
      
      if (!graph || graph.nodes.size < 10) {
        throw new Error(`Граф слишком маленький: ${graph?.nodes.size || 0} узлов`);
      }
      
      updateLocation(location.id, { 
        status: "generating", 
        progress: 55,
        graphNodes: graph.nodes.size,
      });
      
      if (abortRef.current) return false;
      
      // 2. GENERATING
      const serializableGraph = graphToSerializable(graph);
      
      const genResponse = await fetch("/api/admin/panorama/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          graph: serializableGraph,
          coordinates: location.coords,
          theme: location.theme,
          clueCount: location.clueCount,
          locationName: location.name,
          difficulty: location.difficulty,
          save: false, // Сначала генерируем, потом публикуем
        }),
      });
      
      const genData = await genResponse.json();
      
      if (!genData.ok || !genData.mission) {
        throw new Error(genData.error || "Ошибка генерации");
      }
      
      updateLocation(location.id, { progress: 80 });
      
      if (abortRef.current) return false;
      
      // 3. PUBLISHING (если autoPublish)
      if (autoPublish) {
        updateLocation(location.id, { status: "publishing", progress: 90 });
        
        const pubResponse = await fetch("/api/admin/panorama/missions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            mission: genData.mission,
            theme: location.theme,
            publish: true,
            featured: false,
          }),
        });
        
        const pubData = await pubResponse.json();
        
        if (!pubData.ok) {
          throw new Error(pubData.error || "Ошибка публикации");
        }
        
        updateLocation(location.id, { 
          status: "done", 
          progress: 100,
          missionId: pubData.mission?.id || genData.mission.id,
        });
      } else {
        updateLocation(location.id, { 
          status: "done", 
          progress: 100,
          missionId: genData.mission.id,
        });
      }
      
      return true;
      
    } catch (error) {
      console.error(`[Batch] Error generating ${location.name}:`, error);
      updateLocation(location.id, { 
        status: "error", 
        progress: 0,
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
      });
      return false;
    }
  }, [updateLocation, autoPublish, maxDepth, maxNodes]);
  
  // ─── Run batch generation ───
  const runBatch = useCallback(async () => {
    const selectedLocations = locations.filter(loc => selectedIds.has(loc.id));
    
    if (selectedLocations.length === 0) {
      alert("Выберите хотя бы одну локацию");
      return;
    }
    
    setIsRunning(true);
    abortRef.current = false;
    setStats({ total: selectedLocations.length, done: 0, errors: 0 });
    
    // Reset selected locations
    for (const loc of selectedLocations) {
      updateLocation(loc.id, { status: "pending", progress: 0, error: undefined, missionId: undefined });
    }
    
    let done = 0;
    let errors = 0;
    
    for (let i = 0; i < selectedLocations.length; i++) {
      if (abortRef.current) break;
      
      setCurrentIndex(i);
      const location = selectedLocations[i];
      
      const success = await generateMission(location as LocationState);
      
      if (success) {
        done++;
      } else if (!abortRef.current) {
        errors++;
      }
      
      setStats({ total: selectedLocations.length, done, errors });
      
      // Небольшая пауза между генерациями (rate limit)
      if (i < selectedLocations.length - 1 && !abortRef.current) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    setIsRunning(false);
  }, [locations, selectedIds, generateMission, updateLocation]);
  
  // ─── Stop batch ───
  const stopBatch = useCallback(() => {
    abortRef.current = true;
  }, []);
  
  // ─── Get status color ───
  const getStatusColor = (status: GenerationStatus): string => {
    switch (status) {
      case "pending": return "bg-slate-600";
      case "scanning": return "bg-blue-600 animate-pulse";
      case "generating": return "bg-amber-600 animate-pulse";
      case "publishing": return "bg-purple-600 animate-pulse";
      case "done": return "bg-green-600";
      case "error": return "bg-red-600";
      default: return "bg-slate-600";
    }
  };
  
  const getStatusText = (status: GenerationStatus): string => {
    switch (status) {
      case "pending": return "Ожидает";
      case "scanning": return "Сканирование...";
      case "generating": return "Генерация...";
      case "publishing": return "Публикация...";
      case "done": return "Готово!";
      case "error": return "Ошибка";
      default: return "";
    }
  };
  
  return (
    <>
      {/* Google Maps Script */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&libraries=geometry`}
        onLoad={() => setMapsLoaded(true)}
      />
      
      <div className="min-h-screen bg-slate-900 text-white p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                🌍 Batch Generator
              </h1>
              <p className="text-slate-400 mt-1">
                Автоматическая генерация панорамных миссий
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/admin/panorama")}
                className="border-slate-600 text-slate-300"
              >
                ← Генератор
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/admin/panorama/missions")}
                className="border-slate-600 text-slate-300"
              >
                📋 Миссии
              </Button>
            </div>
          </div>
          
          {/* Controls */}
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAll}
                    disabled={isRunning}
                    className="border-slate-600"
                  >
                    Выбрать все
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectNone}
                    disabled={isRunning}
                    className="border-slate-600"
                  >
                    Снять все
                  </Button>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Switch
                      checked={autoPublish}
                      onCheckedChange={setAutoPublish}
                      disabled={isRunning}
                    />
                    <span className="text-sm text-slate-300">Автопубликация</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {isRunning ? (
                    <>
                      <div className="text-sm text-slate-400">
                        {stats.done + stats.errors}/{stats.total} • 
                        <span className="text-green-400 ml-1">{stats.done} ✓</span>
                        {stats.errors > 0 && (
                          <span className="text-red-400 ml-1">{stats.errors} ✗</span>
                        )}
                      </div>
                      <Button
                        onClick={stopBatch}
                        variant="destructive"
                      >
                        ⏹️ Остановить
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={runBatch}
                      disabled={!mapsLoaded || selectedIds.size === 0}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
                    >
                      🚀 Сгенерировать {selectedIds.size} миссий
                    </Button>
                  )}
                </div>
              </div>
              
              {!mapsLoaded && (
                <p className="text-amber-400 text-sm mt-3">
                  ⏳ Загрузка Google Maps...
                </p>
              )}
            </CardContent>
          </Card>
          
          {/* Scan Settings */}
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                ⚙️ Параметры сканирования
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Max Depth */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-300">Глубина обхода</label>
                    <span className="text-cyan-400 font-mono">{maxDepth} шагов</span>
                  </div>
                  <Slider
                    value={[maxDepth]}
                    onValueChange={([v]) => setMaxDepth(v)}
                    min={10}
                    max={100}
                    step={5}
                    disabled={isRunning}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">
                    Больше = глубже обход, дольше сканирование
                  </p>
                </div>
                
                {/* Max Nodes */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-300">Макс. точек</label>
                    <span className="text-cyan-400 font-mono">{maxNodes}</span>
                  </div>
                  <Slider
                    value={[maxNodes]}
                    onValueChange={([v]) => setMaxNodes(v)}
                    min={50}
                    max={500}
                    step={25}
                    disabled={isRunning}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">
                    Больше = больше мест для улик, дольше сканирование
                  </p>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-400">
                  💡 <strong>Рекомендуемые значения:</strong> 40 шагов, 200 точек (~50 сек сканирования).
                  Для больших локаций: 60-80 шагов, 300-400 точек.
                </p>
              </div>
            </CardContent>
          </Card>
          
          {/* Locations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {locations.map((location, index) => (
              <Card 
                key={location.id}
                className={`bg-slate-800/50 border-slate-700 transition-all ${
                  selectedIds.has(location.id) ? "ring-2 ring-cyan-500/50" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleLocation(location.id)}
                      disabled={isRunning}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedIds.has(location.id)
                          ? "bg-cyan-500 border-cyan-500 text-white"
                          : "border-slate-500 hover:border-cyan-400"
                      }`}
                    >
                      {selectedIds.has(location.id) && "✓"}
                    </button>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{location.flag}</span>
                        <h3 className="font-bold text-white truncate">{location.name}</h3>
                      </div>
                      
                      <p className="text-sm text-slate-400 mb-2">{location.description}</p>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant="secondary" className="bg-slate-700 text-xs">
                          {location.theme}
                        </Badge>
                        <Badge variant="secondary" className="bg-slate-700 text-xs">
                          {location.difficulty}
                        </Badge>
                        <Badge variant="secondary" className="bg-slate-700 text-xs">
                          {location.clueCount} улик
                        </Badge>
                        {location.graphNodes && (
                          <Badge variant="secondary" className="bg-slate-700 text-xs">
                            {location.graphNodes} узлов
                          </Badge>
                        )}
                      </div>
                      
                      {/* Progress */}
                      {location.status !== "pending" && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`px-2 py-0.5 rounded ${getStatusColor(location.status)}`}>
                              {getStatusText(location.status)}
                            </span>
                            {location.missionId && (
                              <span className="text-green-400 truncate ml-2">
                                ID: {location.missionId.slice(0, 20)}...
                              </span>
                            )}
                          </div>
                          <Progress value={location.progress} className="h-1.5" />
                          {location.error && (
                            <p className="text-xs text-red-400">{location.error}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Info */}
          <div className="mt-8 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
            <h3 className="font-bold text-white mb-2">💡 Как это работает:</h3>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>1. Выбери локации для генерации</li>
              <li>2. Нажми "Сгенерировать" — процесс автоматический</li>
              <li>3. Каждая миссия: сканирование графа (~30 сек) → генерация → публикация</li>
              <li>4. При ошибке — локация помечается красным, можно перезапустить</li>
              <li>5. Готовые миссии сразу появляются в списке миссий</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

