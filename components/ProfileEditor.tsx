"use client";

/**
 * Profile 2.0 Editor Component
 * Редактирование профиля: bio, статус, витрина достижений, приватность
 */

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { haptic } from "@/lib/haptic";
import { fetchWithAuth } from "@/lib/api";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Types
type UserStatus = "ONLINE" | "PLAYING" | "LOOKING_DUEL" | "BUSY" | "OFFLINE";

type PresetStatus = {
  id: string;
  emoji: string;
  text: string;
  status: UserStatus;
};

// Используем тип из lib/achievements
import { ACHIEVEMENTS, type Achievement as AchievementDef } from "@/lib/achievements";

type Achievement = AchievementDef;

type ProfileEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: {
    bio: string | null;
    status: UserStatus | null;
    statusEmoji: string | null;
    statusText: string | null;
    showcaseAchievements: string[];
    privacy: {
      profilePublic: boolean;
      showActivity: boolean;
      showOnlineStatus: boolean;
    };
  };
  unlockedAchievements: string[];
  presetStatuses: PresetStatus[];
  onSave: () => void;
};

// Константы
const MAX_BIO_LENGTH = 100;
const MAX_STATUS_TEXT_LENGTH = 50;

// Spring анимации
const spring = { type: "spring", stiffness: 400, damping: 30 };

export function ProfileEditor({
  open,
  onOpenChange,
  initialData,
  unlockedAchievements,
  presetStatuses,
  onSave,
}: ProfileEditorProps) {
  // Используем глобальный список достижений
  const allAchievements = ACHIEVEMENTS;
  // State
  const [bio, setBio] = useState(initialData.bio || "");
  const [status, setStatus] = useState<UserStatus>(initialData.status || "ONLINE");
  const [statusEmoji, setStatusEmoji] = useState(initialData.statusEmoji || "🟢");
  const [statusText, setStatusText] = useState(initialData.statusText || "В сети");
  const [showcaseAchievements, setShowcaseAchievements] = useState<(string | null)[]>([
    initialData.showcaseAchievements[0] || null,
    initialData.showcaseAchievements[1] || null,
    initialData.showcaseAchievements[2] || null,
  ]);
  const [privacy, setPrivacy] = useState(initialData.privacy);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("status");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Фильтруем разблокированные достижения
  const availableAchievements = useMemo(() => {
    return allAchievements.filter((a) => unlockedAchievements.includes(a.id));
  }, [allAchievements, unlockedAchievements]);

  // Выбранные достижения для отображения
  const selectedAchievements = useMemo(() => {
    return showcaseAchievements
      .map((id) => allAchievements.find((a) => a.id === id))
      .filter(Boolean) as Achievement[];
  }, [showcaseAchievements, allAchievements]);

  // Обработчик выбора пресета статуса
  const handleSelectPreset = useCallback((preset: PresetStatus) => {
    haptic.selection();
    setStatus(preset.status);
    setStatusEmoji(preset.emoji);
    setStatusText(preset.text);
  }, []);

  // Обработчик выбора достижения для витрины
  const handleToggleShowcase = useCallback((achievementId: string) => {
    haptic.selection();
    setShowcaseAchievements((prev) => {
      const index = prev.indexOf(achievementId);
      if (index !== -1) {
        // Убираем из витрины
        const newArr = [...prev];
        newArr[index] = null;
        return newArr;
      } else {
        // Добавляем в первый свободный слот
        const emptyIndex = prev.findIndex((id) => id === null);
        if (emptyIndex !== -1) {
          const newArr = [...prev];
          newArr[emptyIndex] = achievementId;
          return newArr;
        }
        // Все слоты заняты
        return prev;
      }
    });
  }, []);

  // Сохранение
  const handleSave = useCallback(async () => {
    setSaving(true);
    haptic.medium();

    try {
      const res = await fetchWithAuth("/api/me/profile", {
        method: "PUT",
        body: JSON.stringify({
          bio: bio.trim() || null,
          status,
          statusEmoji,
          statusText: statusText.trim() || null,
          showcaseAchievements,
          privacy,
        }),
      });

      if (res.ok) {
        haptic.success();
        onSave();
        onOpenChange(false);
      } else {
        haptic.error();
      }
    } catch {
      haptic.error();
    } finally {
      setSaving(false);
    }
  }, [bio, status, statusEmoji, statusText, showcaseAchievements, privacy, onSave, onOpenChange]);

  // Популярные emoji для быстрого выбора
  const quickEmojis = ["😊", "😎", "🔥", "💪", "🎮", "🏆", "⚔️", "🕵️", "🌙", "☕", "🤔", "😴", "🎯", "💎", "👑", "🚀"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">✏️</span>
            Редактирование профиля
          </DialogTitle>
          <DialogDescription>
            Настрой свой профиль — покажи кто ты такой!
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 gap-1">
            <TabsTrigger value="status" className="text-xs">
              <span className="mr-1">💬</span> Статус
            </TabsTrigger>
            <TabsTrigger value="achievements" className="text-xs">
              <span className="mr-1">🏆</span> Витрина
            </TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs">
              <span className="mr-1">🔒</span> Приватн.
            </TabsTrigger>
          </TabsList>

          {/* Status Tab */}
          <TabsContent value="status" className="space-y-4 mt-4">
            {/* Bio */}
            <div>
              <label className="text-sm font-semibold mb-2 block">
                О себе
                <span className="text-muted-foreground font-normal ml-2">
                  {bio.length}/{MAX_BIO_LENGTH}
                </span>
              </label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
                placeholder="Расскажи о себе..."
                className="resize-none"
                rows={2}
              />
            </div>

            {/* Preset Statuses */}
            <div>
              <label className="text-sm font-semibold mb-2 block">Быстрые статусы</label>
              <div className="grid grid-cols-2 gap-2">
                {presetStatuses.map((preset) => {
                  const isSelected = statusEmoji === preset.emoji && statusText === preset.text;
                  return (
                    <motion.button
                      key={preset.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectPreset(preset)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="text-xl">{preset.emoji}</span>
                      <span className="text-sm font-medium">{preset.text}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Custom Status */}
            <div className="space-y-3">
              <label className="text-sm font-semibold block">Кастомный статус</label>

              {/* Emoji Picker */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    variant="outline"
                    size="lg"
                    className="text-2xl h-14 w-14"
                    onClick={() => {
                      haptic.light();
                      setShowEmojiPicker(!showEmojiPicker);
                    }}
                  >
                    {statusEmoji}
                  </Button>
                  <Input
                    value={statusText}
                    onChange={(e) => setStatusText(e.target.value.slice(0, MAX_STATUS_TEXT_LENGTH))}
                    placeholder="Твой статус..."
                    className="flex-1"
                  />
                </div>

                <AnimatePresence>
                  {showEmojiPicker && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-8 gap-1 p-2 bg-muted rounded-xl">
                        {quickEmojis.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              haptic.selection();
                              setStatusEmoji(emoji);
                              setShowEmojiPicker(false);
                            }}
                            className={`text-xl p-2 rounded-lg hover:bg-background transition-colors ${
                              statusEmoji === emoji ? "bg-primary/20" : ""
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </TabsContent>

          {/* Achievements Showcase Tab */}
          <TabsContent value="achievements" className="space-y-4 mt-4">
            {/* Selected Showcase */}
            <div>
              <label className="text-sm font-semibold mb-2 block">
                Витрина достижений
                <span className="text-muted-foreground font-normal ml-2">
                  {selectedAchievements.length}/3
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((index) => {
                  const achievement = selectedAchievements[index];
                  return (
                    <motion.div
                      key={index}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: index * 0.05, ...spring }}
                      className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-2 border-2 border-dashed ${
                        achievement
                          ? "border-primary bg-primary/10"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {achievement ? (
                        <>
                          <span className="text-3xl">{achievement.icon}</span>
                          <span className="text-[10px] text-center mt-1 font-medium line-clamp-2">
                            {achievement.name}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-2xl text-muted-foreground">+</span>
                          <span className="text-[10px] text-muted-foreground">Пусто</span>
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Available Achievements */}
            <div>
              <label className="text-sm font-semibold mb-2 block">
                Твои достижения ({availableAchievements.length})
              </label>
              {availableAchievements.length === 0 ? (
                <Card className="bg-muted/50">
                  <CardContent className="py-8 text-center">
                    <span className="text-4xl block mb-2">🔒</span>
                    <p className="text-sm text-muted-foreground">
                      Пока нет разблокированных достижений
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto">
                  {availableAchievements.map((achievement) => {
                    const isSelected = showcaseAchievements.includes(achievement.id);
                    const canAdd =
                      !isSelected && showcaseAchievements.filter(Boolean).length < 3;

                    return (
                      <motion.button
                        key={achievement.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => handleToggleShowcase(achievement.id)}
                        disabled={!isSelected && !canAdd}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                          isSelected
                            ? "border-primary bg-primary/10"
                            : canAdd
                            ? "border-border hover:border-primary/50"
                            : "border-border opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <span className="text-2xl">{achievement.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{achievement.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {achievement.description}
                          </p>
                        </div>
                        {isSelected && (
                          <Badge variant="default" className="shrink-0">
                            ✓
                          </Badge>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span>🔒</span> Настройки приватности
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Profile Public */}
                <PrivacyToggle
                  icon="👤"
                  label="Публичный профиль"
                  description="Любой может видеть твой профиль"
                  enabled={privacy.profilePublic}
                  onChange={(v) => setPrivacy((p) => ({ ...p, profilePublic: v }))}
                />

                {/* Show Activity */}
                <PrivacyToggle
                  icon="🎮"
                  label="Показывать активность"
                  description="Друзья видят во что ты играешь"
                  enabled={privacy.showActivity}
                  onChange={(v) => setPrivacy((p) => ({ ...p, showActivity: v }))}
                />

                {/* Show Online Status */}
                <PrivacyToggle
                  icon="🟢"
                  label="Показывать онлайн"
                  description="Видно когда ты в сети"
                  enabled={privacy.showOnlineStatus}
                  onChange={(v) => setPrivacy((p) => ({ ...p, showOnlineStatus: v }))}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex gap-3 mt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              haptic.light();
              onOpenChange(false);
            }}
          >
            Отмена
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Сохраняем...
              </>
            ) : (
              <>
                <span className="mr-2">✓</span>
                Сохранить
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Privacy Toggle Component
function PrivacyToggle({
  icon,
  label,
  description,
  enabled,
  onChange,
}: {
  icon: string;
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between py-2 cursor-pointer hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
      onClick={() => {
        haptic.selection();
        onChange(!enabled);
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div
        className={`relative w-11 h-6 rounded-full transition-colors ${
          enabled ? "bg-primary" : "bg-muted"
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </div>
    </div>
  );
}

export default ProfileEditor;

