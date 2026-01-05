"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSION GENERATOR - ADMIN PAGE
 * Генератор миссий с автоматическим сканированием Street View
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
  { value: "easy" as const, label: "Лёгкая", icon: "🟢" },
  { value: "medium" as const, label: "Средняя", icon: "🟡" },
  { value: "hard" as const, label: "Сложная", icon: "🟠" },
  { value: "extreme" as const, label: "Экстремальная", icon: "🔴" },
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
  
  // Refs
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const googleMapRef = useRef<any>(null);
  
  // ─── Fetch themes ───
  useEffect(() => {
    async function fetchThemes() {
      try {
        const res = await fetch("/api/admin/panorama/generate");
        const data = await res.json();
        if (data.ok && data.themes) {
          setThemes(data.themes);
        }
      } catch (e) {
        console.error("Failed to fetch themes:", e);
      }
    }
    fetchThemes();
  }, []);
  
  // ─── Initialize map ───
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current) return;
    
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: coordinates[0], lng: coordinates[1] },
      zoom: 15,
      mapTypeId: "roadmap",
      streetViewControl: true,
    });
    
    googleMapRef.current = map;
    
    // Click to set coordinates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.addListener("click", (e: any) => {
      if (e.latLng) {
        setCoordinates([e.latLng.lat(), e.latLng.lng()]);
        setLocationName("Пользовательская точка");
      }
    });
    
    // Update marker
    new google.maps.Marker({
      position: { lat: coordinates[0], lng: coordinates[1] },
      map,
      title: "Старт миссии",
    });
    
  }, [mapsLoaded, coordinates[0], coordinates[1]]);
  
  // ─── Handle preset selection ───
  const handlePresetSelect = useCallback((preset: typeof LOCATION_PRESETS[0]) => {
    setCoordinates(preset.coords);
    setLocationName(preset.name);
    
    if (googleMapRef.current) {
      googleMapRef.current.setCenter({ lat: preset.coords[0], lng: preset.coords[1] });
    }
  }, []);
  
  // ─── Start scanning ───
  const handleStartScan = useCallback(async () => {
    setStep("scanning");
    setError(null);
    setScanProgress(0);
    setScanMessage("Инициализация...");
    
    try {
      const options: BuildGraphOptions = {
        maxDepth,
        maxNodes,
        requestDelay: 100,
        onProgress: (current, total, message) => {
          setScanProgress(Math.round((current / total) * 100));
          setScanMessage(message);
        },
      };
      
      const result = await buildPanoramaGraph(coordinates, options);
      setGraph(result);
      setStep("preview");
      
    } catch (e) {
      console.error("Scan error:", e);
      setError(e instanceof Error ? e.message : "Ошибка сканирования");
      setStep("input");
    }
  }, [coordinates, maxDepth, maxNodes]);
  
  // ─── Generate mission ───
  const handleGenerate = useCallback(async () => {
    if (!graph) return;
    
    setGenerating(true);
    setError(null);
    
    try {
      const res = await fetch("/api/admin/panorama/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
  const handleCopyMission = useCallback(() => {
    if (!generatedMission) return;
    
    navigator.clipboard.writeText(JSON.stringify(generatedMission, null, 2));
    alert("Миссия скопирована в буфер обмена!");
  }, [generatedMission]);
  
  // ─── Reset ───
  const handleReset = useCallback(() => {
    setStep("input");
    setGraph(null);
    setGeneratedMission(null);
    setSpots([]);
    setError(null);
  }, []);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-6">
      {/* Google Maps Script */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        onLoad={() => setMapsLoaded(true)}
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
        
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-xl text-red-200">
            ⚠️ {error}
          </div>
        )}
        
        {/* Steps */}
        <div className="flex items-center gap-4 mb-8">
          {["input", "scanning", "preview", "generated"].map((s, i) => (
            <div 
              key={s}
              className={`flex items-center gap-2 ${
                step === s ? "text-cyan-400" : 
                ["input", "scanning", "preview", "generated"].indexOf(step) > i 
                  ? "text-green-400" 
                  : "text-slate-500"
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                step === s ? "border-cyan-400 bg-cyan-400/20" :
                ["input", "scanning", "preview", "generated"].indexOf(step) > i 
                  ? "border-green-400 bg-green-400/20" 
                  : "border-slate-600"
              }`}>
                {["input", "scanning", "preview", "generated"].indexOf(step) > i ? "✓" : i + 1}
              </div>
              <span className="text-sm font-medium">
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
                      onChange={e => setCoordinates([parseFloat(e.target.value), coordinates[1]])}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs block mb-1">Долгота</label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={coordinates[1]}
                      onChange={e => setCoordinates([coordinates[0], parseFloat(e.target.value)])}
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
                    <label className="text-slate-400 text-xs block mb-1">Глубина обхода (шаги)</label>
                    <Input
                      type="number"
                      min={10}
                      max={60}
                      value={maxDepth}
                      onChange={e => setMaxDepth(parseInt(e.target.value))}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs block mb-1">Макс. точек</label>
                    <Input
                      type="number"
                      min={50}
                      max={400}
                      value={maxNodes}
                      onChange={e => setMaxNodes(parseInt(e.target.value))}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>
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
                      <div className="text-slate-400 text-xs mt-1">{theme.description}</div>
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
                    <span>3</span>
                    <span>7</span>
                  </div>
                </div>
                
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Сложность</label>
                  <div className="flex gap-2 mt-2">
                    {DIFFICULTY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setDifficulty(opt.value)}
                        className={`flex-1 py-2 rounded-lg text-sm transition-all ${
                          difficulty === opt.value
                            ? "bg-cyan-600 text-white"
                            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        }`}
                      >
                        {opt.icon} {opt.label}
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
                    disabled={!mapsLoaded}
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-6 text-lg"
                  >
                    🔍 Начать сканирование
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
                      
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-emerald-400 font-bold">{generatedMission.clues.length}</div>
                          <div className="text-slate-400 text-xs">улик</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-amber-400 font-bold">{generatedMission.xpReward}</div>
                          <div className="text-slate-400 text-xs">XP</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-cyan-400 font-bold">{Math.floor(generatedMission.timeLimit / 60)}м</div>
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
                            <div className="text-slate-400 text-xs">Шаг {clue.distanceFromStart} • {clue.spotType}</div>
                          </div>
                          <div className="text-amber-400 text-sm font-medium">+{clue.xpReward} XP</div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex gap-3">
                      <Button
                        onClick={handleCopyMission}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white"
                      >
                        📋 Скопировать JSON
                      </Button>
                      <Button
                        onClick={handleReset}
                        variant="outline"
                        className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        🔄 Создать ещё
                      </Button>
                    </div>
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

