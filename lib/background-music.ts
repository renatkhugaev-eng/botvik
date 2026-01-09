"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BACKGROUND MUSIC SYSTEM
 * Фоновая музыка для расследований с loop, fade in/out и контролем громкости
 * 
 * Особенности:
 * - Автоматический loop при достижении конца трека
 * - Плавное затухание при паузе/остановке
 * - Восстановление позиции после перезагрузки страницы (опционально)
 * - Поддержка нескольких треков для разных настроений
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

export type MusicTrack = {
  id: string;
  name: string;
  src: string;
  mood?: "tense" | "calm" | "horror" | "mystery" | "action";
};

export type MusicConfig = {
  masterVolume: number;      // 0-1
  fadeInDuration: number;    // ms
  fadeOutDuration: number;   // ms
  enabled: boolean;
  loop: boolean;
};

type MusicState = "stopped" | "playing" | "paused" | "fading";

// ═══════════════════════════════════════════════════════════════════════════
// ПРЕДУСТАНОВЛЕННЫЕ ТРЕКИ
// ═══════════════════════════════════════════════════════════════════════════

export const INVESTIGATION_TRACKS: MusicTrack[] = [
  {
    id: "red-forest-ambient",
    name: "Красный лес — Атмосфера",
    src: "/audio/follows-dark-ambient-194926.mp3",
    mood: "horror",
  },
  // Можно добавить больше треков для разных эпизодов/настроений
];

// ═══════════════════════════════════════════════════════════════════════════
// BACKGROUND MUSIC CLASS
// ═══════════════════════════════════════════════════════════════════════════

class BackgroundMusic {
  private audio: HTMLAudioElement | null = null;
  private config: MusicConfig;
  private state: MusicState = "stopped";
  private currentTrack: MusicTrack | null = null;
  private fadeInterval: NodeJS.Timeout | null = null;
  private targetVolume: number = 0;
  
  // Callbacks
  private onStateChange?: (state: MusicState) => void;
  private onTrackEnd?: () => void;
  
  constructor(config?: Partial<MusicConfig>) {
    this.config = {
      masterVolume: 0.3,
      fadeInDuration: 2000,
      fadeOutDuration: 1500,
      enabled: true,
      loop: true,
      ...config,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ИНИЦИАЛИЗАЦИЯ
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Инициализация аудио элемента
   * Требует user gesture для автозапуска на мобильных
   */
  private initAudio(track: MusicTrack): HTMLAudioElement {
    // Очистка предыдущего
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio.load();
    }
    
    const audio = new Audio(track.src);
    audio.loop = this.config.loop;
    audio.volume = 0; // Начинаем с нуля для fade in
    audio.preload = "auto";
    
    // Event listeners
    audio.addEventListener("ended", this.handleTrackEnd.bind(this));
    audio.addEventListener("error", this.handleError.bind(this));
    audio.addEventListener("canplaythrough", () => {
      console.log(`[BackgroundMusic] Track "${track.name}" ready to play`);
    });
    
    this.audio = audio;
    this.currentTrack = track;
    
    return audio;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ВОСПРОИЗВЕДЕНИЕ
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Запуск музыки
   * @param track - трек для воспроизведения (или использует текущий/первый)
   */
  async play(track?: MusicTrack | string): Promise<boolean> {
    if (!this.config.enabled) return false;
    if (typeof window === "undefined") return false;
    
    // Определяем трек
    let targetTrack: MusicTrack | undefined;
    
    if (typeof track === "string") {
      targetTrack = INVESTIGATION_TRACKS.find(t => t.id === track);
    } else if (track) {
      targetTrack = track;
    } else if (this.currentTrack) {
      targetTrack = this.currentTrack;
    } else {
      targetTrack = INVESTIGATION_TRACKS[0];
    }
    
    if (!targetTrack) {
      console.warn("[BackgroundMusic] No track to play");
      return false;
    }
    
    // Если уже играет этот трек — ничего не делаем
    if (this.state === "playing" && this.currentTrack?.id === targetTrack.id) {
      return true;
    }
    
    // Инициализация или смена трека
    if (!this.audio || this.currentTrack?.id !== targetTrack.id) {
      this.initAudio(targetTrack);
    }
    
    if (!this.audio) return false;
    
    try {
      // Попытка воспроизведения
      await this.audio.play();
      this.setState("playing");
      
      // Fade in
      this.fadeToVolume(this.config.masterVolume, this.config.fadeInDuration);
      
      console.log(`[BackgroundMusic] Playing: ${targetTrack.name}`);
      return true;
    } catch (error) {
      // Обычно это ошибка автозапуска без user gesture
      console.warn("[BackgroundMusic] Playback blocked:", error);
      this.setState("stopped");
      return false;
    }
  }
  
  /**
   * Пауза с fade out
   */
  async pause(): Promise<void> {
    if (!this.audio || this.state !== "playing") return;
    
    this.setState("fading");
    
    // Fade out перед паузой
    await this.fadeToVolume(0, this.config.fadeOutDuration);
    
    if (this.audio) {
      this.audio.pause();
      this.setState("paused");
    }
  }
  
  /**
   * Возобновление после паузы
   */
  async resume(): Promise<boolean> {
    if (!this.audio || this.state !== "paused") {
      return this.play();
    }
    
    try {
      await this.audio.play();
      this.setState("playing");
      this.fadeToVolume(this.config.masterVolume, this.config.fadeInDuration);
      return true;
    } catch (error) {
      console.warn("[BackgroundMusic] Resume blocked:", error);
      return false;
    }
  }
  
  /**
   * Остановка музыки
   */
  async stop(): Promise<void> {
    if (!this.audio) return;
    
    this.setState("fading");
    
    // Fade out
    await this.fadeToVolume(0, this.config.fadeOutDuration);
    
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.setState("stopped");
    }
  }
  
  /**
   * Toggle play/pause
   */
  async toggle(): Promise<boolean> {
    if (this.state === "playing") {
      await this.pause();
      return false;
    } else {
      return await this.play();
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ГРОМКОСТЬ
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Установка громкости (мгновенно)
   */
  setVolume(volume: number): void {
    this.config.masterVolume = Math.max(0, Math.min(1, volume));
    
    if (this.audio && this.state === "playing") {
      this.audio.volume = this.config.masterVolume;
    }
  }
  
  /**
   * Плавное изменение громкости
   */
  private fadeToVolume(targetVolume: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.audio) {
        resolve();
        return;
      }
      
      // Отмена предыдущего fade
      if (this.fadeInterval) {
        clearInterval(this.fadeInterval);
      }
      
      this.targetVolume = targetVolume;
      const startVolume = this.audio.volume;
      const volumeDiff = targetVolume - startVolume;
      const steps = 30; // 30 шагов для плавности
      const stepDuration = duration / steps;
      let currentStep = 0;
      
      this.fadeInterval = setInterval(() => {
        currentStep++;
        
        if (!this.audio || currentStep >= steps) {
          if (this.audio) {
            this.audio.volume = targetVolume;
          }
          if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
          }
          resolve();
          return;
        }
        
        // Easing функция для более естественного звучания
        const progress = currentStep / steps;
        const easedProgress = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
        this.audio.volume = startVolume + volumeDiff * easedProgress;
      }, stepDuration);
    });
  }
  
  /**
   * Временное приглушение (для диалогов, кат-сцен)
   */
  async duck(targetVolume: number = 0.1, duration: number = 500): Promise<void> {
    if (!this.audio || this.state !== "playing") return;
    await this.fadeToVolume(targetVolume, duration);
  }
  
  /**
   * Восстановление громкости после duck
   */
  async unduck(duration: number = 500): Promise<void> {
    if (!this.audio || this.state !== "playing") return;
    await this.fadeToVolume(this.config.masterVolume, duration);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // СОБЫТИЯ
  // ─────────────────────────────────────────────────────────────────────────
  
  private handleTrackEnd(): void {
    console.log("[BackgroundMusic] Track ended");
    this.onTrackEnd?.();
    
    // Если loop выключен, сбрасываем состояние
    if (!this.config.loop) {
      this.setState("stopped");
    }
  }
  
  private handleError(e: Event): void {
    console.error("[BackgroundMusic] Error:", e);
    this.setState("stopped");
  }
  
  private setState(state: MusicState): void {
    this.state = state;
    this.onStateChange?.(state);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // CALLBACKS
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Подписка на изменение состояния
   */
  onState(callback: (state: MusicState) => void): void {
    this.onStateChange = callback;
  }
  
  /**
   * Подписка на окончание трека
   */
  onEnd(callback: () => void): void {
    this.onTrackEnd = callback;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // КОНФИГУРАЦИЯ
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Обновление конфигурации
   */
  updateConfig(config: Partial<MusicConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.audio) {
      this.audio.loop = this.config.loop;
      
      if (this.state === "playing") {
        this.audio.volume = this.config.masterVolume;
      }
    }
  }
  
  /**
   * Включение/выключение музыки
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    
    if (!enabled && this.state === "playing") {
      this.stop();
    }
  }
  
  /**
   * Получить текущее состояние
   */
  getState(): MusicState {
    return this.state;
  }
  
  /**
   * Получить текущий трек
   */
  getCurrentTrack(): MusicTrack | null {
    return this.currentTrack;
  }
  
  /**
   * Получить текущую позицию (секунды)
   */
  getCurrentTime(): number {
    return this.audio?.currentTime || 0;
  }
  
  /**
   * Получить длительность трека (секунды)
   */
  getDuration(): number {
    return this.audio?.duration || 0;
  }
  
  /**
   * Получить громкость
   */
  getVolume(): number {
    return this.config.masterVolume;
  }
  
  /**
   * Проверка: играет ли музыка
   */
  isPlaying(): boolean {
    return this.state === "playing";
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ОЧИСТКА
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Полная очистка
   */
  destroy(): void {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
    }
    
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio.load();
      this.audio = null;
    }
    
    this.currentTrack = null;
    this.state = "stopped";
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let backgroundMusicInstance: BackgroundMusic | null = null;

export function getBackgroundMusic(): BackgroundMusic {
  if (!backgroundMusicInstance) {
    backgroundMusicInstance = new BackgroundMusic();
  }
  return backgroundMusicInstance;
}

export { BackgroundMusic };
export default BackgroundMusic;
