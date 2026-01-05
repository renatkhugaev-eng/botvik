"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSION GENERATOR - ADMIN PAGE
 * Генератор миссий с автоматическим сканированием Street View
 * 
 * v2.0.0 - Исправлено:
 * - Корректная очистка маркеров
 * - Кнопка отмены сканирования
 * - Улучшенная обработка ошибок
 * - Превью миссии
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const google: any;

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  buildPanoramaGraph, 
  graphToSerializable,
  type BuildGraphOptions 
} from "@/lib/panorama-graph-builder";
import type { 
  PanoramaGraph, 
  ClueSpot, 
  MissionThemeType,
  GeneratedMission 
} from "@/types/panorama-graph";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ThemeOption {
  type: MissionThemeType;
  title: string;
  description: string;
  icon: string;
  color: string;
  clueCount: number;
}

type GeneratorStep = "input" | "scanning" | "preview" | "generated";

// ═══════════════════════════════════════════════════════════════════════════
// PRESETS
// ═══════════════════════════════════════════════════════════════════════════

const LOCATION_PRESETS = [
  { name: "Токио, Сибуя", coords: [35.6594, 139.7006] as [number, number] },
  { name: "Лондон, Сохо", coords: [51.5137, -0.1318] as [number, number] },
  { name: "Лас-Вегас, Стрип", coords: [36.1147, -115.1728] as [number, number] },
  { name: "Рим, Ватикан", coords: [41.9029, 12.4534] as [number, number] },
  { name: "Сидней, Гавань", coords: [-33.8599, 151.2090] as [number, number] },
  { name: "Амстердам, Каналы", coords: [52.3676, 4.9041] as [number, number] },
  { name: "Нью-Йорк, Таймс-Сквер", coords: [40.7580, -73.9855] as [number, number] },
  { name: "Париж, Эйфелева башня", coords: [48.8584, 2.2945] as [number, number] },
];

const DIFFICULTY_OPTIONS = [
  { value: "easy" as const, label: "Лёгкая", icon: "🟢", desc: "15 мин, 60% улик" },
  { value: "medium" as const, label: "Средняя", icon: "🟡", desc: "12 мин, 70% улик" },
  { value: "hard" as const, label: "Сложная", icon: "🟠", desc: "10 мин, 80% улик" },
  { value: "extreme" as const, label: "Экстрим", icon: "🔴", desc: "8 мин, 90% улик" },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function PanoramaGeneratorPage() {
  const router = useRouter();
  
  // ─── State ───
  const [step, setStep] = useState<GeneratorStep>("input");
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [themesError, setThemesError] = useState<string | null>(null);
  
  // Input state
  const [coordinates, setCoordinates] = useState<[number, number]>([35.6594, 139.7006]);
  const [locationName, setLocationName] = useState("Токио, Сибуя");
  const [selectedTheme, setSelectedTheme] = useState<MissionThemeType>("yakuza");
  const [clueCount, setClueCount] = useState(5);
  const [maxDepth, setMaxDepth] = useState(40);
  const [maxNodes, setMaxNodes] = useState(200);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "extreme">("hard");
  
  // Scanning state
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState("");
  const [graph, setGraph] = useState<PanoramaGraph | null>(null);
  
  // Generation state
  const [spots, setSpots] = useState<ClueSpot[]>([]);
  const [generatedMission, setGeneratedMission] = useState<GeneratedMission | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Refs
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // ─── Fetch themes ───
  useEffect(() => {
    async function fetchThemes() {
      try {
        setThemesError(null);
        const res = await fetch("/api/admin/panorama/generate", {
          credentials: "include",
        });
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        
        const data = await res.json();
        
        if (data.ok && data.themes) {
          setThemes(data.themes);
        } else {
          throw new Error(data.error || "Unknown error");
        }
      } catch (e) {
        console.error("Failed to fetch themes:", e);
        setThemesError("Не удалось загрузить темы. Проверьте авторизацию.");
      }
    }
    fetchThemes();
  }, []);
  
  // ─── Initialize map ───
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current) return;
    
    // Создаём карту только один раз
    if (!googleMapRef.current) {
      googleMapRef.current = new google.maps.Map(mapRef.current, {
        center: { lat: coordinates[0], lng: coordinates[1] },
        zoom: 15,
        mapTypeId: "roadmap",
        streetViewControl: true,
      });
      
      // Click to set coordinates
      googleMapRef.current.addListener("click", (e: any) => {
        if (e.latLng) {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          setCoordinates([lat, lng]);
          setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      });
    }
    
    // Обновляем маркер
    updateMarker(coordinates[0], coordinates[1]);
    
  }, [mapsLoaded]);
  
  // ─── Update marker when coordinates change ───
  useEffect(() => {
    if (googleMapRef.current) {
      updateMarker(coordinates[0], coordinates[1]);
      googleMapRef.current.setCenter({ lat: coordinates[0], lng: coordinates[1] });
    }
  }, [coordinates]);
  
  // ─── Helper: Update marker ───
  const updateMarker = useCallback((lat: number, lng: number) => {
    // Удаляем старый маркер
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }
    
    // Создаём новый
    if (googleMapRef.current) {
      markerRef.current = new google.maps.Marker({
        position: { lat, lng },
        map: googleMapRef.current,
        title: "Старт миссии",
        animation: google.maps.Animation.DROP,
      });
    }
  }, []);
  
  // ─── Handle preset selection ───
  const handlePresetSelect = useCallback((preset: typeof LOCATION_PRESETS[0]) => {
    setCoordinates(preset.coords);
    setLocationName(preset.name);
  }, []);
  
  // ─── Start scanning ───
  const handleStartScan = useCallback(async () => {
    setStep("scanning");
    setError(null);
    setScanProgress(0);
    setScanMessage("Инициализация...");
    
    // Создаём AbortController для возможности отмены
    abortControllerRef.current = new AbortController();
    
    try {
      const options: BuildGraphOptions = {
        maxDepth,
        maxNodes,
        requestDelay: 200, // Безопасная задержка для Google API
        onProgress: (current, total, message) => {
          setScanProgress(Math.round((current / total) * 100));
          setScanMessage(message);
        },
        signal: abortControllerRef.current.signal,
      };
      
      const result = await buildPanoramaGraph(coordinates, options);
      setGraph(result);
      setStep("preview");
      
    } catch (e) {
      // Проверяем, была ли это отмена
      if ((e as Error).name === "AbortError") {
        console.log("[Panorama] Scan cancelled by user");
        setStep("input");
        return;
      }
      
      console.error("Scan error:", e);
      setError(e instanceof Error ? e.message : "Ошибка сканирования");
      setStep("input");
    } finally {
      abortControllerRef.current = null;
    }
  }, [coordinates, maxDepth, maxNodes]);
  
  // ─── Cancel scanning ───
  const handleCancelScan = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);
  
  // ─── Generate mission ───
  const handleGenerate = useCallback(async () => {
    if (!graph) return;
    
    setGenerating(true);
    setError(null);
    
    try {
      const res = await fetch("/api/admin/panorama/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          coordinates,
          theme: selectedTheme,
          clueCount,
          locationName,
          difficulty,
          graph: graphToSerializable(graph),
          save: false,
        }),
      });
      
      const data = await res.json();
      
      if (!data.ok) {
        throw new Error(data.error || "Ошибка генерации");
      }
      
      setGeneratedMission(data.mission);
      setSpots(data.spots || []);
      setStep("generated");
      
    } catch (e) {
      console.error("Generation error:", e);
      setError(e instanceof Error ? e.message : "Ошибка генерации");
    } finally {
      setGenerating(false);
    }
  }, [graph, coordinates, selectedTheme, clueCount, locationName, difficulty]);
  
  // ─── Copy mission JSON ───
  const handleCopyMission = useCallback(async () => {
    if (!generatedMission) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(generatedMission, null, 2));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (e) {
      console.error("Copy failed:", e);
      setError("Не удалось скопировать в буфер обмена");
    }
  }, [generatedMission]);
  
  // ─── Preview mission ───
  const handlePreviewMission = useCallback(() => {
    if (!generatedMission) return;
    
    // Сохраняем миссию во временное хранилище
    sessionStorage.setItem("previewMission", JSON.stringify(generatedMission));
    window.open("/miniapp/panorama/preview", "_blank");
  }, [generatedMission]);
  
  // ─── Reset ───
  const handleReset = useCallback(() => {
    setStep("input");
    setGraph(null);
    setGeneratedMission(null);
    setSpots([]);
    setError(null);
    setCopySuccess(false);
  }, []);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  
  return (
    <div className="pb-8">
      {/* Google Maps Script */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&libraries=places`}
        onLoad={() => setMapsLoaded(true)}
        onError={() => setError("Не удалось загрузить Google Maps API")}
      />
      
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              🗺️ Генератор панорамных миссий
            </h1>
            <p className="text-slate-400 mt-1">
              Автоматическое создание миссий через Google Street View
            </p>
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => router.push("/admin")}
            className="text-slate-300 border-slate-600 hover:bg-slate-700"
          >
            ← Назад
          </Button>
        </div>
        
        {/* Themes loading error */}
        {themesError && (
          <div className="mb-6 p-4 bg-amber-900/50 border border-amber-500 rounded-xl text-amber-200">
            ⚠️ {themesError}
          </div>
        )}
        
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-xl text-red-200 flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button 
              onClick={() => setError(null)}
              className="text-red-300 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}
        
        {/* Steps */}
        <div className="flex items-center gap-4 mb-8">
          {(["input", "scanning", "preview", "generated"] as const).map((s, i) => (
            <div 
              key={s}
              className={`flex items-center gap-2 ${
                step === s ? "text-cyan-400" : 
                (["input", "scanning", "preview", "generated"] as const).indexOf(step) > i 
                  ? "text-green-400" 
                  : "text-slate-500"
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-sm font-medium ${
                step === s ? "border-cyan-400 bg-cyan-400/20" :
                (["input", "scanning", "preview", "generated"] as const).indexOf(step) > i 
                  ? "border-green-400 bg-green-400/20" 
                  : "border-slate-600"
              }`}>
                {(["input", "scanning", "preview", "generated"] as const).indexOf(step) > i ? "✓" : i + 1}
              </div>
              <span className="text-sm font-medium hidden sm:inline">
                {s === "input" && "Настройка"}
                {s === "scanning" && "Сканирование"}
                {s === "preview" && "Предпросмотр"}
                {s === "generated" && "Готово"}
              </span>
              {i < 3 && <span className="text-slate-600">→</span>}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Map & Settings */}
          <div className="space-y-6">
            {/* Map */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-lg">📍 Локация</CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  ref={mapRef} 
                  className="w-full h-64 rounded-lg bg-slate-700"
                />
                
                <div className="mt-4 flex flex-wrap gap-2">
                  {LOCATION_PRESETS.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => handlePresetSelect(preset)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        locationName === preset.name
                          ? "bg-cyan-600 text-white"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
                
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 text-xs block mb-1">Широта</label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={coordinates[0]}
                      onChange={e => setCoordinates([parseFloat(e.target.value) || 0, coordinates[1]])}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs block mb-1">Долгота</label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={coordinates[1]}
                      onChange={e => setCoordinates([coordinates[0], parseFloat(e.target.value) || 0])}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Scan Settings */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-lg">⚙️ Параметры сканирования</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Название локации</label>
                  <Input
                    value={locationName}
                    onChange={e => setLocationName(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                    placeholder="Введите название..."
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 text-xs block mb-1">
                      Глубина обхода: {maxDepth} шагов
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={60}
                      value={maxDepth}
                      onChange={e => setMaxDepth(parseInt(e.target.value))}
                      className="w-full mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs block mb-1">
                      Макс. точек: {maxNodes}
                    </label>
                    <input
                      type="range"
                      min={50}
                      max={400}
                      step={50}
                      value={maxNodes}
                      onChange={e => setMaxNodes(parseInt(e.target.value))}
                      className="w-full mt-1"
                    />
                  </div>
                </div>
                
                <p className="text-slate-500 text-xs">
                  💡 Время сканирования: ~{Math.ceil(maxNodes * 0.25)} сек
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Right Column - Theme & Generation */}
          <div className="space-y-6">
            {/* Theme Selection */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-lg">🎭 Тема миссии</CardTitle>
              </CardHeader>
              <CardContent>
                {themes.length === 0 && !themesError && (
                  <div className="text-center py-8 text-slate-400">
                    Загрузка тем...
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3">
                  {themes.map(theme => (
                    <button
                      key={theme.type}
                      onClick={() => setSelectedTheme(theme.type)}
                      className={`p-4 rounded-xl text-left transition-all ${
                        selectedTheme === theme.type
                          ? "ring-2 ring-cyan-400 bg-slate-700"
                          : "bg-slate-700/50 hover:bg-slate-700"
                      }`}
                    >
                      <div className="text-2xl mb-2">{theme.icon}</div>
                      <div className="text-white font-medium text-sm">{theme.title}</div>
                      <div className="text-slate-400 text-xs mt-1 line-clamp-2">{theme.description}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Clue & Difficulty */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-lg">🔍 Улики и сложность</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Количество улик: {clueCount}</label>
                  <input
                    type="range"
                    min={3}
                    max={7}
                    value={clueCount}
                    onChange={e => setClueCount(parseInt(e.target.value))}
                    className="w-full mt-2"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>3 (легко)</span>
                    <span>7 (сложно)</span>
                  </div>
                </div>
                
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Сложность</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {DIFFICULTY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setDifficulty(opt.value)}
                        className={`py-2 px-3 rounded-lg text-sm transition-all text-left ${
                          difficulty === opt.value
                            ? "bg-cyan-600 text-white"
                            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        }`}
                      >
                        <div>{opt.icon} {opt.label}</div>
                        <div className="text-xs opacity-70">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Actions */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6">
                {step === "input" && (
                  <Button
                    onClick={handleStartScan}
                    disabled={!mapsLoaded || themes.length === 0}
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-6 text-lg"
                  >
                    {!mapsLoaded ? "⏳ Загрузка карты..." : "🔍 Начать сканирование"}
                  </Button>
                )}
                
                {step === "scanning" && (
                  <div className="text-center py-4">
                    <div className="text-6xl mb-4 animate-pulse">🛰️</div>
                    <div className="w-full bg-slate-700 rounded-full h-3 mb-3">
                      <div 
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                    <p className="text-cyan-400 font-medium">{scanProgress}%</p>
                    <p className="text-slate-400 text-sm mt-2">{scanMessage}</p>
                    
                    <Button
                      onClick={handleCancelScan}
                      variant="outline"
                      className="mt-4 border-red-600 text-red-400 hover:bg-red-600/20"
                    >
                      ✕ Отменить
                    </Button>
                  </div>
                )}
                
                {step === "preview" && graph && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-slate-700/50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-cyan-400">{graph.stats.totalNodes}</div>
                        <div className="text-xs text-slate-400">Панорам</div>
                      </div>
                      <div className="bg-slate-700/50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-orange-400">{graph.stats.deadEnds}</div>
                        <div className="text-xs text-slate-400">Тупиков</div>
                      </div>
                      <div className="bg-slate-700/50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-purple-400">{graph.stats.intersections}</div>
                        <div className="text-xs text-slate-400">Перекрёстков</div>
                      </div>
                    </div>
                    
                    <div className="bg-slate-700/30 rounded-lg p-3 text-sm text-slate-300">
                      <div className="flex justify-between">
                        <span>Углов:</span>
                        <span className="text-amber-400">{graph.stats.corners}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span>Макс. глубина:</span>
                        <span className="text-green-400">{graph.stats.maxDepth} шагов</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span>Ср. связей:</span>
                        <span className="text-blue-400">{graph.stats.avgLinks}</span>
                      </div>
                    </div>
                    
                    <Button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white py-6 text-lg"
                    >
                      {generating ? "⏳ Генерация..." : "✨ Сгенерировать миссию"}
                    </Button>
                    
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      ← Начать заново
                    </Button>
                  </div>
                )}
                
                {step === "generated" && generatedMission && (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-emerald-900/50 to-green-900/50 rounded-xl p-4 border border-emerald-500/30">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-3xl">{generatedMission.icon}</span>
                        <div>
                          <h3 className="text-white font-bold">{generatedMission.title}</h3>
                          <p className="text-emerald-300 text-sm">{generatedMission.location}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2 text-center text-sm">
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-emerald-400 font-bold">{generatedMission.clues.length}</div>
                          <div className="text-slate-400 text-xs">улик</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-cyan-400 font-bold">{generatedMission.requiredClues}</div>
                          <div className="text-slate-400 text-xs">нужно</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-amber-400 font-bold">{generatedMission.xpReward}</div>
                          <div className="text-slate-400 text-xs">XP</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-pink-400 font-bold">{Math.floor(generatedMission.timeLimit / 60)}м</div>
                          <div className="text-slate-400 text-xs">лимит</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Clues list */}
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {generatedMission.clues.map((clue, i) => (
                        <div 
                          key={clue.id}
                          className="flex items-center gap-3 bg-slate-700/50 rounded-lg p-3"
                        >
                          <span className="text-xl">{clue.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm font-medium truncate">{clue.name}</div>
                            <div className="text-slate-400 text-xs">
                              Шаг {clue.distanceFromStart} • {clue.spotType} • {clue.coneDegrees}° • {clue.dwellTime}с
                            </div>
                          </div>
                          <div className="text-amber-400 text-sm font-medium">+{clue.xpReward}</div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={handleCopyMission}
                        className={`${copySuccess ? "bg-green-600" : "bg-slate-700 hover:bg-slate-600"} text-white`}
                      >
                        {copySuccess ? "✓ Скопировано!" : "📋 Скопировать JSON"}
                      </Button>
                      <Button
                        onClick={handlePreviewMission}
                        className="bg-purple-600 hover:bg-purple-500 text-white"
                      >
                        🎮 Тест
                      </Button>
                    </div>
                    
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      🔄 Создать ещё
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
