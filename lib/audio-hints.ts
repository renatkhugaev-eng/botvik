"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUDIO HINT SYSTEM
 * Генерация звуков через Web Audio API для детективных подсказок
 * 
 * Звуки:
 * - Heartbeat: низкочастотные пульсы, частота зависит от близости
 * - Static: белый шум с модуляцией
 * - Whisper: фильтрованный шум с эффектом шёпота
 * - Discovery: восходящий тон при обнаружении
 * - Collect: аккорд при сборе улики
 * - Scanner: синтетический пинг
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { 
  AudioConfig, 
  IntensityLevel,
} from "@/types/audio-hints";

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO HINT SYSTEM CLASS
// ═══════════════════════════════════════════════════════════════════════════

class AudioHintSystem {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private config: AudioConfig;
  
  // Active oscillators and nodes
  private heartbeatOsc: OscillatorNode | null = null;
  private heartbeatGain: GainNode | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  private staticSource: AudioBufferSourceNode | null = null;
  private staticGain: GainNode | null = null;
  private staticFilter: BiquadFilterNode | null = null;
  
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  
  // State
  private isInitialized = false;
  private currentIntensity: IntensityLevel = "cold";
  private isHeartbeatPlaying = false;
  private isStaticPlaying = false;
  
  constructor(config?: Partial<AudioConfig>) {
    this.config = {
      masterVolume: 0.7,
      enabled: true,
      heartbeatVolume: 0.6,
      staticVolume: 0.3,
      ambientVolume: 0.4,
      effectsVolume: 0.8,
      ...config,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Инициализация AudioContext (требует user gesture)
   */
  async init(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (typeof window === "undefined") return false;
    
    try {
      // @ts-expect-error - webkitAudioContext for Safari
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.warn("[AudioHints] Web Audio API not supported");
        return false;
      }
      
      this.context = new AudioContextClass();
      
      // Resume if suspended (iOS requirement)
      if (this.context.state === "suspended") {
        await this.context.resume();
      }
      
      // Master gain
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.config.masterVolume;
      this.masterGain.connect(this.context.destination);
      
      this.isInitialized = true;
      console.log("[AudioHints] Initialized successfully");
      return true;
    } catch (error) {
      console.error("[AudioHints] Failed to initialize:", error);
      return false;
    }
  }
  
  /**
   * Проверка инициализации
   */
  private ensureInit(): boolean {
    if (!this.isInitialized || !this.context || !this.masterGain) {
      console.warn("[AudioHints] Not initialized. Call init() first.");
      return false;
    }
    if (!this.config.enabled) return false;
    return true;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // HEARTBEAT
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Запуск heartbeat с заданным BPM
   * @param bpm - ударов в минуту (60-180)
   */
  startHeartbeat(bpm: number = 80): void {
    if (!this.ensureInit()) return;
    if (this.isHeartbeatPlaying) {
      this.updateHeartbeatRate(bpm);
      return;
    }
    
    this.isHeartbeatPlaying = true;
    const intervalMs = (60 / bpm) * 1000;
    
    this.playHeartbeatPulse();
    this.heartbeatInterval = setInterval(() => {
      this.playHeartbeatPulse();
    }, intervalMs);
  }
  
  /**
   * Один пульс heartbeat
   */
  private playHeartbeatPulse(): void {
    if (!this.context || !this.masterGain) return;
    
    const now = this.context.currentTime;
    
    // Двойной удар как настоящее сердцебиение
    this.playSinglePulse(now, 0.08);
    this.playSinglePulse(now + 0.12, 0.05);
  }
  
  private playSinglePulse(startTime: number, duration: number): void {
    if (!this.context || !this.masterGain) return;
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = "sine";
    osc.frequency.value = 40; // Низкая частота
    
    const volume = this.config.heartbeatVolume * this.config.masterVolume;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(startTime);
    osc.stop(startTime + duration + 0.1);
  }
  
  /**
   * Обновление частоты heartbeat
   */
  updateHeartbeatRate(bpm: number): void {
    if (!this.isHeartbeatPlaying) return;
    
    // Перезапуск с новым интервалом
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    const intervalMs = (60 / Math.min(180, Math.max(60, bpm))) * 1000;
    this.heartbeatInterval = setInterval(() => {
      this.playHeartbeatPulse();
    }, intervalMs);
  }
  
  /**
   * Остановка heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.isHeartbeatPlaying = false;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // STATIC NOISE
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Запуск static помех
   * @param intensity - интенсивность (0-1)
   */
  startStatic(intensity: number = 0.5): void {
    if (!this.ensureInit() || !this.context || !this.masterGain) return;
    if (this.isStaticPlaying) {
      this.updateStaticIntensity(intensity);
      return;
    }
    
    this.isStaticPlaying = true;
    
    // Создаём белый шум
    const bufferSize = this.context.sampleRate * 2;
    const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    
    this.staticSource = this.context.createBufferSource();
    this.staticSource.buffer = noiseBuffer;
    this.staticSource.loop = true;
    
    // Фильтр для "радио" эффекта
    this.staticFilter = this.context.createBiquadFilter();
    this.staticFilter.type = "bandpass";
    this.staticFilter.frequency.value = 1000;
    this.staticFilter.Q.value = 0.5;
    
    // Gain
    this.staticGain = this.context.createGain();
    this.staticGain.gain.value = intensity * this.config.staticVolume * this.config.masterVolume;
    
    this.staticSource.connect(this.staticFilter);
    this.staticFilter.connect(this.staticGain);
    this.staticGain.connect(this.masterGain);
    
    this.staticSource.start();
  }
  
  /**
   * Обновление интенсивности static
   */
  updateStaticIntensity(intensity: number): void {
    if (!this.staticGain || !this.context) return;
    
    const targetVolume = intensity * this.config.staticVolume * this.config.masterVolume;
    this.staticGain.gain.linearRampToValueAtTime(
      targetVolume,
      this.context.currentTime + 0.1
    );
  }
  
  /**
   * Остановка static
   */
  stopStatic(): void {
    if (this.staticSource) {
      try {
        this.staticSource.stop();
      } catch {}
      this.staticSource.disconnect();
      this.staticSource = null;
    }
    if (this.staticGain) {
      this.staticGain.disconnect();
      this.staticGain = null;
    }
    if (this.staticFilter) {
      this.staticFilter.disconnect();
      this.staticFilter = null;
    }
    this.isStaticPlaying = false;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ONE-SHOT SOUNDS
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Звук обнаружения улики (восходящий тон)
   */
  playDiscovery(): void {
    if (!this.ensureInit() || !this.context || !this.masterGain) return;
    
    const now = this.context.currentTime;
    const volume = this.config.effectsVolume * this.config.masterVolume;
    
    // Восходящий тон
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
    
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.6);
    
    // Второй гармоник
    const osc2 = this.context.createOscillator();
    const gain2 = this.context.createGain();
    
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(600, now + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
    
    gain2.gain.setValueAtTime(volume * 0.5, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    
    osc2.start(now + 0.1);
    osc2.stop(now + 0.7);
  }
  
  /**
   * Звук сбора улики (мажорный аккорд)
   */
  playCollect(): void {
    if (!this.ensureInit() || !this.context || !this.masterGain) return;
    
    const now = this.context.currentTime;
    const volume = this.config.effectsVolume * this.config.masterVolume * 0.3;
    
    // Мажорный аккорд: C-E-G
    const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
    
    frequencies.forEach((freq, i) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();
      
      osc.type = "triangle";
      osc.frequency.value = freq;
      
      const startTime = now + i * 0.05;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.8);
      
      osc.connect(gain);
      gain.connect(this.masterGain!);
      
      osc.start(startTime);
      osc.stop(startTime + 1);
    });
  }
  
  /**
   * Звук сканера (синтетический пинг)
   */
  playScanner(): void {
    if (!this.ensureInit() || !this.context || !this.masterGain) return;
    
    const now = this.context.currentTime;
    const volume = this.config.effectsVolume * this.config.masterVolume * 0.4;
    
    // Высокий пинг с затуханием
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(2000, now);
    osc.frequency.exponentialRampToValueAtTime(1000, now + 0.3);
    
    filter.type = "lowpass";
    filter.frequency.value = 3000;
    
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.5);
  }
  
  /**
   * Мягкая подсказка (лёгкий тон)
   */
  playHint(): void {
    if (!this.ensureInit() || !this.context || !this.masterGain) return;
    
    const now = this.context.currentTime;
    const volume = this.config.effectsVolume * this.config.masterVolume * 0.2;
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = "sine";
    osc.frequency.value = 800;
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.3);
  }
  
  /**
   * Звук напряжения (дрон)
   */
  playTension(duration: number = 2): void {
    if (!this.ensureInit() || !this.context || !this.masterGain) return;
    
    const now = this.context.currentTime;
    const volume = this.config.ambientVolume * this.config.masterVolume * 0.3;
    
    // Низкий дрон
    const osc1 = this.context.createOscillator();
    const osc2 = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc1.type = "sawtooth";
    osc1.frequency.value = 55; // A1
    
    osc2.type = "sawtooth";
    osc2.frequency.value = 55.5; // Слегка расстроен для биений
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.5);
    gain.gain.setValueAtTime(volume, now + duration - 0.5);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.1);
    osc2.stop(now + duration + 0.1);
  }
  
  /**
   * Звук шёпота (фильтрованный шум)
   */
  playWhisper(): void {
    if (!this.ensureInit() || !this.context || !this.masterGain) return;
    
    const now = this.context.currentTime;
    const duration = 1.5;
    const volume = this.config.ambientVolume * this.config.masterVolume * 0.2;
    
    // Белый шум
    const bufferSize = this.context.sampleRate * duration;
    const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    
    const source = this.context.createBufferSource();
    source.buffer = noiseBuffer;
    
    // Bandpass filter для голосоподобного звука
    const filter = this.context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 500;
    filter.Q.value = 2;
    
    // Модуляция частоты
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    lfo.frequency.value = 3;
    lfoGain.gain.value = 200;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.2);
    gain.gain.setValueAtTime(volume, now + duration - 0.3);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    lfo.start(now);
    source.start(now);
    lfo.stop(now + duration);
    source.stop(now + duration);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // INTENSITY CONTROL
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Установка интенсивности подсказок
   * Автоматически управляет heartbeat и static
   */
  setIntensity(intensity: IntensityLevel): void {
    if (this.currentIntensity === intensity) return;
    this.currentIntensity = intensity;
    
    switch (intensity) {
      case "cold":
        this.stopHeartbeat();
        this.stopStatic();
        break;
        
      case "warm":
        this.startHeartbeat(80);
        this.stopStatic();
        break;
        
      case "hot":
        this.updateHeartbeatRate(120);
        this.startStatic(0.3);
        break;
        
      case "burning":
        this.updateHeartbeatRate(160);
        this.updateStaticIntensity(0.7);
        break;
    }
  }
  
  /**
   * Получить BPM для расстояния (0-1, где 0 = рядом)
   */
  getBpmForDistance(normalizedDistance: number): number {
    // 0 = 160 BPM, 1 = 60 BPM
    return Math.round(160 - normalizedDistance * 100);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // REVEAL PROGRESS SOUNDS
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Обновление звука при обнаружении (0-1)
   */
  updateRevealProgress(progress: number): void {
    if (!this.ensureInit() || !this.context) return;
    
    // Static нарастает с прогрессом
    if (progress > 0) {
      this.startStatic(progress * 0.8);
      
      // Heartbeat ускоряется
      const bpm = 80 + progress * 100; // 80 -> 180
      if (!this.isHeartbeatPlaying) {
        this.startHeartbeat(bpm);
      } else {
        this.updateHeartbeatRate(bpm);
      }
    }
    
    // При завершении — звук обнаружения
    if (progress >= 1) {
      this.stopStatic();
      this.stopHeartbeat();
      this.playDiscovery();
    }
  }
  
  /**
   * Сброс звуков при отмене обнаружения
   */
  cancelReveal(): void {
    this.stopStatic();
    this.stopHeartbeat();
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // CONFIG & CLEANUP
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Обновление конфигурации
   */
  updateConfig(config: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.masterGain) {
      this.masterGain.gain.value = this.config.masterVolume;
    }
  }
  
  /**
   * Включение/выключение звуков
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    
    if (!enabled) {
      this.stopAll();
    }
  }
  
  /**
   * Остановка всех звуков
   */
  stopAll(): void {
    this.stopHeartbeat();
    this.stopStatic();
    
    if (this.ambientOsc) {
      try {
        this.ambientOsc.stop();
      } catch {}
      this.ambientOsc = null;
    }
  }
  
  /**
   * Полная очистка
   */
  destroy(): void {
    this.stopAll();
    
    if (this.context) {
      this.context.close();
      this.context = null;
    }
    
    this.masterGain = null;
    this.isInitialized = false;
  }
  
  /**
   * Проверка поддержки
   */
  static isSupported(): boolean {
    if (typeof window === "undefined") return false;
    // @ts-expect-error - webkitAudioContext for Safari
    return !!(window.AudioContext || window.webkitAudioContext);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let audioHintInstance: AudioHintSystem | null = null;

export function getAudioHints(): AudioHintSystem {
  if (!audioHintInstance) {
    audioHintInstance = new AudioHintSystem();
  }
  return audioHintInstance;
}

export { AudioHintSystem };
export default AudioHintSystem;

