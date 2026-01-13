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
  {
    id: "madness_ambience",
    name: "Безумие",
    src: "/audio/follows-dark-ambient-194926.mp3", // TODO: Заменить на отдельный трек madness
    mood: "horror",
  },
  {
    id: "market-ambient",
    name: "Рынок — Атмосфера провинции",
    src: "/audio/market-ambient.mp3",
    mood: "calm",
  },
  // Можно добавить больше треков для разных эпизодов/настроений
];

// Ambient слой — играет параллельно с основным треком, тише
export const AMBIENT_TRACKS: MusicTrack[] = [
  {
    id: "red-forest-weather",
    name: "Пасмурная погода",
    src: "/audio/obemnyy-shum-pasmurnoy-pogody.mp3",
    mood: "horror",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// BACKGROUND MUSIC CLASS
// ═══════════════════════════════════════════════════════════════════════════

class BackgroundMusic {
  private audio: HTMLAudioElement | null = null;
  private config: MusicConfig;
  private state: MusicState = "stopped";
  private currentTrack: MusicTrack | null = null;
  private previousTrack: MusicTrack | null = null;  // Для восстановления при выходе из локации
  private fadeInterval: NodeJS.Timeout | null = null;
  private targetVolume: number = 0;
  
  // Ambient layer — параллельный звуковой слой (тише основного)
  private ambientAudio: HTMLAudioElement | null = null;
  private ambientTrack: MusicTrack | null = null;
  private ambientFadeInterval: NodeJS.Timeout | null = null;
  private ambientVolumeMultiplier: number = 0.5; // 50% от основной громкости
  
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
    // Очистка предыдущего - просто останавливаем, новый элемент заменит старый
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
    }
    
    if (!track?.src) {
      console.error("[BackgroundMusic] ОШИБКА: track.src пустой или undefined!");
      throw new Error("Track source is empty");
    }
    
    console.log(`[BackgroundMusic] Инициализация трека: ${track.name} (${track.src})`);
    
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
  
  /**
   * Инициализация ambient слоя
   */
  private initAmbientAudio(track: MusicTrack): HTMLAudioElement {
    // Очистка предыдущего
    if (this.ambientAudio) {
      this.ambientAudio.pause();
      this.ambientAudio.src = "";
    }
    
    if (!track?.src) {
      console.error("[BackgroundMusic] ОШИБКА: ambient track.src пустой!");
      throw new Error("Ambient track source is empty");
    }
    
    console.log(`[BackgroundMusic] Инициализация ambient: ${track.name} (${track.src})`);
    
    const audio = new Audio(track.src);
    audio.loop = true; // Ambient всегда в loop
    audio.volume = 0;
    audio.preload = "auto";
    
    audio.addEventListener("error", (e) => {
      const target = e.target as HTMLAudioElement | null;
      console.error("[BackgroundMusic] Ambient error:", target?.error?.code, target?.src);
    });
    audio.addEventListener("canplaythrough", () => {
      console.log(`[BackgroundMusic] Ambient "${track.name}" ready to play`);
    });
    
    this.ambientAudio = audio;
    this.ambientTrack = track;
    
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
      console.warn("[BackgroundMusic] Трек не найден:", track);
      return false;
    }
    
    // Если уже играет этот трек — ничего не делаем
    if (this.state === "playing" && this.currentTrack?.id === targetTrack.id) {
      return true;
    }
    
    // Сохраняем предыдущий трек для восстановления
    if (this.currentTrack && this.currentTrack.id !== targetTrack.id) {
      this.previousTrack = this.currentTrack;
      console.log(`[BackgroundMusic] Сохранён предыдущий трек: ${this.previousTrack.name}`);
    }
    
    // Инициализация или смена трека
    if (!this.audio || this.currentTrack?.id !== targetTrack.id) {
      this.initAudio(targetTrack);
    }
    
    if (!this.audio) return false;
    
    try {
      // Попытка воспроизведения основного трека
      await this.audio.play();
      this.setState("playing");
      
      // Fade in основного трека
      this.fadeToVolume(this.config.masterVolume, this.config.fadeInDuration);
      
      // Запуск ambient слоя (параллельно)
      await this.playAmbient();
      
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
   * Запуск ambient слоя (параллельный звук)
   */
  private async playAmbient(track?: MusicTrack | string): Promise<boolean> {
    // Определяем ambient трек
    let targetTrack: MusicTrack | undefined;
    
    if (typeof track === "string") {
      targetTrack = AMBIENT_TRACKS.find(t => t.id === track);
    } else if (track) {
      targetTrack = track;
    } else if (this.ambientTrack) {
      targetTrack = this.ambientTrack;
    } else {
      targetTrack = AMBIENT_TRACKS[0]; // Первый ambient трек по умолчанию
    }
    
    if (!targetTrack) {
      // Нет ambient треков — это нормально
      return false;
    }
    
    // Инициализация ambient
    if (!this.ambientAudio || this.ambientTrack?.id !== targetTrack.id) {
      this.initAmbientAudio(targetTrack);
    }
    
    if (!this.ambientAudio) return false;
    
    try {
      await this.ambientAudio.play();
      
      // Fade in ambient (тише основного)
      const ambientVolume = this.config.masterVolume * this.ambientVolumeMultiplier;
      this.fadeAmbientToVolume(ambientVolume, this.config.fadeInDuration);
      
      console.log(`[BackgroundMusic] Ambient playing: ${targetTrack.name}`);
      return true;
    } catch (error) {
      console.warn("[BackgroundMusic] Ambient playback blocked:", error);
      return false;
    }
  }
  
  /**
   * Пауза с fade out
   */
  async pause(): Promise<void> {
    if (!this.audio || this.state !== "playing") return;
    
    this.setState("fading");
    
    // Fade out обоих слоёв параллельно
    await Promise.all([
      this.fadeToVolume(0, this.config.fadeOutDuration),
      this.fadeAmbientToVolume(0, this.config.fadeOutDuration),
    ]);
    
    if (this.audio) {
      this.audio.pause();
    }
    if (this.ambientAudio) {
      this.ambientAudio.pause();
    }
    this.setState("paused");
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
      
      // Возобновляем ambient если есть
      if (this.ambientAudio) {
        await this.ambientAudio.play();
      }
      
      this.setState("playing");
      this.fadeToVolume(this.config.masterVolume, this.config.fadeInDuration);
      
      // Fade in ambient
      const ambientVolume = this.config.masterVolume * this.ambientVolumeMultiplier;
      this.fadeAmbientToVolume(ambientVolume, this.config.fadeInDuration);
      
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
    this.setState("fading");
    
    // Fade out обоих слоёв параллельно
    await Promise.all([
      this.audio ? this.fadeToVolume(0, this.config.fadeOutDuration) : Promise.resolve(),
      this.ambientAudio ? this.fadeAmbientToVolume(0, this.config.fadeOutDuration) : Promise.resolve(),
    ]);
    
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    if (this.ambientAudio) {
      this.ambientAudio.pause();
      this.ambientAudio.currentTime = 0;
    }
    this.setState("stopped");
  }
  
  /**
   * Остановка текущего трека и восстановление предыдущего
   * Используется при выходе из локаций со своей музыкой
   */
  async stopAndRestorePrevious(): Promise<boolean> {
    // Fade out текущего трека
    if (this.audio && this.state === "playing") {
      await this.fadeToVolume(0, this.config.fadeOutDuration);
      this.audio.pause();
    }
    
    // Восстанавливаем предыдущий трек
    if (this.previousTrack) {
      console.log(`[BackgroundMusic] Восстановление трека: ${this.previousTrack.name}`);
      const trackToRestore = this.previousTrack;
      this.previousTrack = null; // Очищаем чтобы не зациклиться
      return await this.play(trackToRestore);
    } else {
      // Если предыдущего нет — играем основной ambient
      console.log("[BackgroundMusic] Нет предыдущего трека, играем основной ambient");
      return await this.play("red-forest-ambient");
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
    
    // Ambient тоже обновляем (пропорционально)
    if (this.ambientAudio && this.state === "playing") {
      this.ambientAudio.volume = this.config.masterVolume * this.ambientVolumeMultiplier;
    }
  }
  
  /**
   * Плавное изменение громкости основного трека
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
   * Плавное изменение громкости ambient слоя
   */
  private fadeAmbientToVolume(targetVolume: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ambientAudio) {
        resolve();
        return;
      }
      
      // Отмена предыдущего fade
      if (this.ambientFadeInterval) {
        clearInterval(this.ambientFadeInterval);
      }
      
      const startVolume = this.ambientAudio.volume;
      const volumeDiff = targetVolume - startVolume;
      const steps = 30;
      const stepDuration = duration / steps;
      let currentStep = 0;
      
      this.ambientFadeInterval = setInterval(() => {
        currentStep++;
        
        if (!this.ambientAudio || currentStep >= steps) {
          if (this.ambientAudio) {
            this.ambientAudio.volume = targetVolume;
          }
          if (this.ambientFadeInterval) {
            clearInterval(this.ambientFadeInterval);
            this.ambientFadeInterval = null;
          }
          resolve();
          return;
        }
        
        const progress = currentStep / steps;
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        this.ambientAudio.volume = startVolume + volumeDiff * easedProgress;
      }, stepDuration);
    });
  }
  
  /**
   * Временное приглушение (для диалогов, кат-сцен)
   */
  async duck(targetVolume: number = 0.1, duration: number = 500): Promise<void> {
    if (this.state !== "playing") return;
    
    await Promise.all([
      this.audio ? this.fadeToVolume(targetVolume, duration) : Promise.resolve(),
      this.ambientAudio ? this.fadeAmbientToVolume(targetVolume * this.ambientVolumeMultiplier, duration) : Promise.resolve(),
    ]);
  }
  
  /**
   * Восстановление громкости после duck
   */
  async unduck(duration: number = 500): Promise<void> {
    if (this.state !== "playing") return;
    
    await Promise.all([
      this.audio ? this.fadeToVolume(this.config.masterVolume, duration) : Promise.resolve(),
      this.ambientAudio ? this.fadeAmbientToVolume(this.config.masterVolume * this.ambientVolumeMultiplier, duration) : Promise.resolve(),
    ]);
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
    // Получаем детали ошибки из HTMLMediaElement
    const target = e.target as HTMLAudioElement | null;
    const error = target?.error;
    
    console.error("[BackgroundMusic] Audio Error Details:", {
      errorCode: error?.code,
      errorMessage: error?.message,
      audioSrc: target?.src,
      networkState: target?.networkState,  // 0=EMPTY, 1=IDLE, 2=LOADING, 3=NO_SOURCE
      readyState: target?.readyState,      // 0=HAVE_NOTHING, 1=HAVE_METADATA, etc.
    });
    
    // Детальные сообщения об ошибках
    switch (error?.code) {
      case 1: // MEDIA_ERR_ABORTED
        console.error("[BackgroundMusic] Загрузка прервана пользователем");
        break;
      case 2: // MEDIA_ERR_NETWORK
        console.error("[BackgroundMusic] Сетевая ошибка при загрузке");
        break;
      case 3: // MEDIA_ERR_DECODE
        console.error("[BackgroundMusic] Ошибка декодирования аудио");
        break;
      case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
        console.error("[BackgroundMusic] Формат не поддерживается или файл не найден:", target?.src);
        break;
    }
    
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
    
    // Ambient всегда в loop, обновляем только громкость
    if (this.ambientAudio && this.state === "playing") {
      this.ambientAudio.volume = this.config.masterVolume * this.ambientVolumeMultiplier;
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
    if (this.ambientFadeInterval) {
      clearInterval(this.ambientFadeInterval);
    }
    
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio = null;
    }
    
    if (this.ambientAudio) {
      this.ambientAudio.pause();
      this.ambientAudio.src = "";
      this.ambientAudio = null;
    }
    
    this.currentTrack = null;
    this.ambientTrack = null;
    this.state = "stopped";
  }
  
  /**
   * Установка множителя громкости ambient слоя
   * @param multiplier - 0-1, по умолчанию 0.5 (50% от основного)
   */
  setAmbientVolumeMultiplier(multiplier: number): void {
    this.ambientVolumeMultiplier = Math.max(0, Math.min(1, multiplier));
    
    if (this.ambientAudio && this.state === "playing") {
      this.ambientAudio.volume = this.config.masterVolume * this.ambientVolumeMultiplier;
    }
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
