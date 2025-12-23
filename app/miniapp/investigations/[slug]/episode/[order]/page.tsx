"use client";

import { useState, useEffect, use, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { haptic } from "@/lib/haptic";
import { api } from "@/lib/api";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type EpisodeType = "STORY" | "QUIZ" | "EVIDENCE" | "INTERROGATION" | "DEDUCTION";

type StoryScene = {
  id: string;
  text: string;
  image?: string | null;
  next?: string;
  choices?: { id: string; text: string; next: string }[];
  isEnd?: boolean;
};

type StoryContent = {
  scenes: StoryScene[];
};

type QuizQuestion = {
  id: string;
  text: string;
  options: { id: string; text: string; isCorrect: boolean }[];
  explanation?: string;
  points: number;
};

type QuizContent = {
  questions: QuizQuestion[];
};

type EvidenceItem = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

type EvidenceContent = {
  items: EvidenceItem[];
  connections: { from: string; to: string; label: string }[];
  correctAnswer: string[];
};

type DialogueNode = {
  id: string;
  npc: string;
  choices?: { id: string; text: string; stress: number; next: string }[];
  isEnd?: boolean;
  result?: string;
};

type InterrogationContent = {
  suspect: { name: string; description: string; avatar?: string | null };
  dialogue: DialogueNode[];
};

type DeductionContent = {
  instruction: string;
  timeLimit?: number;
};

type EpisodeData = {
  episode: {
    id: number;
    order: number;
    title: string;
    description: string | null;
    type: EpisodeType;
    content: StoryContent | QuizContent | EvidenceContent | InterrogationContent | DeductionContent;
    minScore: number | null;
    timeLimit: number | null;
    xpReward: number;
  };
  progress: {
    status: string;
    score: number;
    choices: Record<string, string> | null;
  };
  investigation: {
    title: string;
    collectedClues: string[];
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// EPISODE PLAYER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// ═══ STORY PLAYER ═══
function StoryPlayer({ 
  content, 
  onComplete 
}: { 
  content: StoryContent; 
  onComplete: (choices: Record<string, string>) => void;
}) {
  const [currentSceneId, setCurrentSceneId] = useState(content.scenes[0]?.id || "");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [isTyping, setIsTyping] = useState(true);

  const currentScene = content.scenes.find(s => s.id === currentSceneId);

  useEffect(() => {
    setIsTyping(true);
    const timer = setTimeout(() => setIsTyping(false), 1500);
    return () => clearTimeout(timer);
  }, [currentSceneId]);

  const handleChoice = (choiceId: string, nextSceneId: string) => {
    haptic.light();
    setChoices(prev => ({ ...prev, [currentSceneId]: choiceId }));
    setCurrentSceneId(nextSceneId);
  };

  const handleNext = () => {
    haptic.light();
    if (currentScene?.isEnd) {
      onComplete(choices);
    } else if (currentScene?.next) {
      setCurrentSceneId(currentScene.next);
    }
  };

  if (!currentScene) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Scene image placeholder */}
      <div className="h-48 bg-gradient-to-b from-[#1a1a2e] to-transparent flex items-center justify-center">
        <div className="text-6xl opacity-30">📖</div>
      </div>

      {/* Text area */}
      <div className="flex-1 p-6">
        <motion.div
          key={currentSceneId}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 rounded-2xl p-5 border border-white/10"
        >
          <p className="text-white/90 leading-relaxed text-[15px]">
            {currentScene.text}
          </p>
        </motion.div>

        {/* Choices or Next button */}
        <div className="mt-6 space-y-3">
          {!isTyping && currentScene.choices && currentScene.choices.length > 0 ? (
            currentScene.choices.map((choice, index) => (
              <motion.button
                key={choice.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleChoice(choice.id, choice.next)}
                className="w-full text-left p-4 rounded-xl bg-gradient-to-r from-violet-600/20 to-purple-600/20 
                  border border-violet-500/30 hover:border-violet-500/60 transition-all"
              >
                <span className="text-violet-300 mr-2">{String.fromCharCode(65 + index)}.</span>
                <span className="text-white/90">{choice.text}</span>
              </motion.button>
            ))
          ) : !isTyping ? (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={handleNext}
              className="w-full py-4 rounded-xl bg-white/10 text-white font-medium"
            >
              {currentScene.isEnd ? "Завершить" : "Далее →"}
            </motion.button>
          ) : (
            <div className="flex justify-center py-4">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 bg-white/40 rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══ QUIZ PLAYER ═══
function QuizPlayer({ 
  content, 
  onComplete 
}: { 
  content: QuizContent; 
  onComplete: (score: number, answers: Record<string, string>) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  const currentQuestion = content.questions[currentIndex];
  const isLastQuestion = currentIndex === content.questions.length - 1;

  const handleSelectOption = (optionId: string) => {
    if (showResult) return;
    haptic.light();
    setSelectedOption(optionId);
  };

  const handleConfirm = () => {
    if (!selectedOption) return;
    haptic.medium();
    
    const option = currentQuestion.options.find(o => o.id === selectedOption);
    const isCorrect = option?.isCorrect ?? false;
    
    if (isCorrect) {
      setScore(prev => prev + currentQuestion.points);
      haptic.success();
    } else {
      haptic.error();
    }
    
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: selectedOption }));
    setShowResult(true);
  };

  const handleNext = () => {
    haptic.light();
    if (isLastQuestion) {
      const finalScore = score + (currentQuestion.options.find(o => o.id === selectedOption)?.isCorrect ? currentQuestion.points : 0);
      onComplete(finalScore, answers);
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowResult(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / content.questions.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-white/50">
          {currentIndex + 1}/{content.questions.length}
        </span>
      </div>

      {/* Score */}
      <div className="flex justify-end mb-4">
        <div className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium">
          {score} очков
        </div>
      </div>

      {/* Question */}
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-6"
      >
        <h3 className="text-lg font-medium text-white leading-relaxed">
          {currentQuestion.text}
        </h3>
      </motion.div>

      {/* Options */}
      <div className="flex-1 space-y-3">
        {currentQuestion.options.map((option, index) => {
          const isSelected = selectedOption === option.id;
          const isCorrect = option.isCorrect;
          
          let optionStyle = "bg-white/5 border-white/10";
          if (showResult) {
            if (isCorrect) {
              optionStyle = "bg-green-500/20 border-green-500/50";
            } else if (isSelected && !isCorrect) {
              optionStyle = "bg-red-500/20 border-red-500/50";
            }
          } else if (isSelected) {
            optionStyle = "bg-violet-500/20 border-violet-500/50";
          }

          return (
            <motion.button
              key={option.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleSelectOption(option.id)}
              disabled={showResult}
              className={`w-full text-left p-4 rounded-xl border transition-all ${optionStyle}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${isSelected ? 'bg-violet-500 text-white' : 'bg-white/10 text-white/60'}`}
                >
                  {String.fromCharCode(65 + index)}
                </div>
                <span className="text-white/90">{option.text}</span>
                {showResult && isCorrect && <span className="ml-auto text-green-400">✓</span>}
                {showResult && isSelected && !isCorrect && <span className="ml-auto text-red-400">✗</span>}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Explanation */}
      <AnimatePresence>
        {showResult && currentQuestion.explanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30"
          >
            <p className="text-sm text-blue-200">{currentQuestion.explanation}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action button */}
      <div className="mt-6">
        {!showResult ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleConfirm}
            disabled={!selectedOption}
            className={`w-full py-4 rounded-xl font-semibold transition-all
              ${selectedOption 
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white' 
                : 'bg-white/10 text-white/40'
              }`}
          >
            Ответить
          </motion.button>
        ) : (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleNext}
            className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-green-600 to-emerald-600 text-white"
          >
            {isLastQuestion ? "Завершить" : "Следующий вопрос →"}
          </motion.button>
        )}
      </div>
    </div>
  );
}

// ═══ EVIDENCE PLAYER ═══
function EvidencePlayer({ 
  content, 
  onComplete 
}: { 
  content: EvidenceContent; 
  onComplete: (score: number) => void;
}) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);

  const toggleItem = (itemId: string) => {
    haptic.light();
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSubmit = () => {
    haptic.medium();
    setShowResult(true);
    
    // Calculate score based on correct selections
    const correctCount = selectedItems.filter(id => content.correctAnswer.includes(id)).length;
    const wrongCount = selectedItems.filter(id => !content.correctAnswer.includes(id)).length;
    const score = Math.max(0, (correctCount * 50) - (wrongCount * 25));
    
    setTimeout(() => {
      onComplete(score);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full p-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-medium text-white mb-2">Выберите ключевые улики</h3>
        <p className="text-sm text-white/50">Отметьте улики, которые важны для расследования</p>
      </div>

      {/* Evidence grid */}
      <div className="grid grid-cols-2 gap-3 flex-1">
        {content.items.map((item, index) => {
          const isSelected = selectedItems.includes(item.id);
          const isCorrect = content.correctAnswer.includes(item.id);
          
          let itemStyle = "bg-white/5 border-white/10";
          if (showResult) {
            if (isCorrect && isSelected) {
              itemStyle = "bg-green-500/20 border-green-500/50";
            } else if (isCorrect && !isSelected) {
              itemStyle = "bg-yellow-500/20 border-yellow-500/50";
            } else if (!isCorrect && isSelected) {
              itemStyle = "bg-red-500/20 border-red-500/50";
            }
          } else if (isSelected) {
            itemStyle = "bg-violet-500/20 border-violet-500/50";
          }

          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => !showResult && toggleItem(item.id)}
              disabled={showResult}
              className={`p-4 rounded-xl border transition-all text-center ${itemStyle}`}
            >
              <div className="text-3xl mb-2">{item.icon}</div>
              <div className="text-sm font-medium text-white">{item.name}</div>
              <div className="text-xs text-white/50 mt-1">{item.description}</div>
              {isSelected && !showResult && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center text-xs">
                  ✓
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Submit button */}
      {!showResult && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={selectedItems.length === 0}
          className={`mt-6 w-full py-4 rounded-xl font-semibold transition-all
            ${selectedItems.length > 0 
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white' 
              : 'bg-white/10 text-white/40'
            }`}
        >
          Подтвердить выбор ({selectedItems.length})
        </motion.button>
      )}

      {showResult && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 text-center text-white/70"
        >
          Анализируем улики...
        </motion.div>
      )}
    </div>
  );
}

// ═══ INTERROGATION PLAYER ═══
function InterrogationPlayer({ 
  content, 
  onComplete 
}: { 
  content: InterrogationContent; 
  onComplete: (answers: Record<string, string>) => void;
}) {
  const [currentNodeId, setCurrentNodeId] = useState(content.dialogue[0]?.id || "");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [stress, setStress] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  const currentNode = content.dialogue.find(n => n.id === currentNodeId);

  useEffect(() => {
    setIsTyping(true);
    const timer = setTimeout(() => setIsTyping(false), 1000);
    return () => clearTimeout(timer);
  }, [currentNodeId]);

  const handleChoice = (choiceId: string, nextNodeId: string, stressIncrease: number) => {
    haptic.light();
    setAnswers(prev => ({ ...prev, [currentNodeId]: choiceId }));
    setStress(prev => Math.min(100, prev + stressIncrease));
    setCurrentNodeId(nextNodeId);
  };

  useEffect(() => {
    if (currentNode?.isEnd) {
      setTimeout(() => onComplete(answers), 1500);
    }
  }, [currentNode, answers, onComplete]);

  if (!currentNode) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Suspect info */}
      <div className="p-4 bg-gradient-to-b from-[#1a1a2e] to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-3xl">
            👤
          </div>
          <div>
            <div className="font-medium text-white">{content.suspect.name}</div>
            <div className="text-xs text-white/50">{content.suspect.description}</div>
          </div>
        </div>
        
        {/* Stress meter */}
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/50">Уровень стресса</span>
            <span className={stress > 70 ? "text-red-400" : stress > 40 ? "text-yellow-400" : "text-green-400"}>
              {stress}%
            </span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              className={`h-full ${stress > 70 ? "bg-red-500" : stress > 40 ? "bg-yellow-500" : "bg-green-500"}`}
              animate={{ width: `${stress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Dialogue */}
      <div className="flex-1 p-4">
        <motion.div
          key={currentNodeId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 rounded-2xl p-4 border border-white/10"
        >
          <div className="flex items-start gap-2">
            <span className="text-lg">💬</span>
            <p className="text-white/90 leading-relaxed">{currentNode.npc}</p>
          </div>
        </motion.div>

        {/* Choices */}
        <div className="mt-6 space-y-3">
          {!isTyping && currentNode.choices ? (
            currentNode.choices.map((choice, index) => (
              <motion.button
                key={choice.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleChoice(choice.id, choice.next, choice.stress)}
                className="w-full text-left p-4 rounded-xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 
                  border border-cyan-500/30 hover:border-cyan-500/60 transition-all"
              >
                <span className="text-white/90">{choice.text}</span>
                {choice.stress > 0 && (
                  <span className="ml-2 text-xs text-yellow-400">+{choice.stress} стресс</span>
                )}
              </motion.button>
            ))
          ) : !isTyping && currentNode.isEnd ? (
            <div className="text-center text-white/50 py-4">
              Допрос завершён...
            </div>
          ) : (
            <div className="flex justify-center py-4">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 bg-white/40 rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══ DEDUCTION PLAYER ═══
function DeductionPlayer({ 
  suspects,
  onComplete 
}: { 
  suspects: { id: number; name: string; description: string }[];
  onComplete: (suspectId: number) => void;
}) {
  const [selectedSuspect, setSelectedSuspect] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleSelect = (suspectId: number) => {
    haptic.light();
    setSelectedSuspect(suspectId);
  };

  const handleConfirm = () => {
    if (!selectedSuspect) return;
    haptic.heavy();
    setConfirming(true);
    setTimeout(() => {
      onComplete(selectedSuspect);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full p-4">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-2">🧠 Финальная дедукция</h3>
        <p className="text-sm text-white/50">
          На основе собранных улик определите преступника
        </p>
      </div>

      {/* Suspects */}
      <div className="flex-1 space-y-4">
        {suspects.map((suspect, index) => (
          <motion.button
            key={suspect.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.15 }}
            onClick={() => handleSelect(suspect.id)}
            disabled={confirming}
            className={`w-full text-left p-4 rounded-xl border transition-all
              ${selectedSuspect === suspect.id 
                ? 'bg-red-500/20 border-red-500/50' 
                : 'bg-white/5 border-white/10 hover:border-white/30'
              }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-2xl">
                👤
              </div>
              <div className="flex-1">
                <div className="font-medium text-white">{suspect.name}</div>
                <div className="text-xs text-white/50 mt-1 line-clamp-2">{suspect.description}</div>
              </div>
              {selectedSuspect === suspect.id && (
                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">✓</span>
                </div>
              )}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Confirm button */}
      <motion.button
        whileHover={{ scale: confirming ? 1 : 1.02 }}
        whileTap={{ scale: confirming ? 1 : 0.98 }}
        onClick={handleConfirm}
        disabled={!selectedSuspect || confirming}
        className={`mt-6 w-full py-4 rounded-xl font-semibold transition-all
          ${selectedSuspect && !confirming
            ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white' 
            : 'bg-white/10 text-white/40'
          }`}
      >
        {confirming ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Обвиняем...
          </span>
        ) : (
          "Обвинить"
        )}
      </motion.button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function EpisodePage({ 
  params 
}: { 
  params: Promise<{ slug: string; order: string }> 
}) {
  const { slug, order } = use(params);
  const router = useRouter();
  
  const [data, setData] = useState<EpisodeData | null>(null);
  const [suspects, setSuspects] = useState<{ id: number; name: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [result, setResult] = useState<{ score: number; xpEarned: number } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const episodeData = await api.get<EpisodeData>(`/api/investigations/${slug}/episode/${order}`);
        setData(episodeData);
        
        // For deduction, also fetch suspects
        if (episodeData.episode.type === "DEDUCTION") {
          const invData = await api.get<{ suspects: { id: number; name: string; description: string }[] }>(
            `/api/investigations/${slug}`
          );
          setSuspects(invData.suspects);
        }
      } catch (err) {
        console.error(err);
        setError("Не удалось загрузить эпизод");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [slug, order]);

  const handleComplete = useCallback(async (score: number, extras?: Record<string, unknown>) => {
    if (!data) return;
    
    try {
      const response = await api.post<{ success: boolean; xpEarned: number; isLastEpisode: boolean }>(
        `/api/investigations/${slug}/episode/${order}`,
        { score, ...extras }
      );
      
      setResult({ score, xpEarned: response.xpEarned });
      setCompleted(true);
      haptic.success();
    } catch (err) {
      console.error(err);
    }
  }, [data, slug, order]);

  const handleContinue = () => {
    haptic.light();
    router.push(`/miniapp/investigations/${slug}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/20 border-t-red-500 mx-auto" />
          <p className="mt-4 text-sm text-white/50">Загрузка эпизода...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">😔</div>
          <p className="text-white/70">{error}</p>
          <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-white/10 rounded-lg text-white/70">
            Назад
          </button>
        </div>
      </div>
    );
  }

  // Result screen
  if (completed && result) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <motion.div 
            className="text-6xl mb-4"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5 }}
          >
            🎉
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-2">Эпизод пройден!</h2>
          <p className="text-white/50 mb-6">{data.episode.title}</p>
          
          <div className="flex justify-center gap-6 mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-400">{result.score}</div>
              <div className="text-xs text-white/50">Очков</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">+{result.xpEarned}</div>
              <div className="text-xs text-white/50">XP</div>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleContinue}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold"
          >
            Продолжить расследование
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button
          onClick={() => {
            haptic.light();
            router.back();
          }}
          className="text-white/60 hover:text-white"
        >
          ✕
        </button>
        <div className="text-center">
          <div className="text-xs text-white/40">Эпизод {data.episode.order}</div>
          <div className="text-sm font-medium">{data.episode.title}</div>
        </div>
        <div className="w-6" /> {/* Spacer */}
      </div>

      {/* Episode content */}
      <div className="flex-1 overflow-hidden">
        {data.episode.type === "STORY" && (
          <StoryPlayer 
            content={data.episode.content as StoryContent} 
            onComplete={(choices) => handleComplete(100, { choices })}
          />
        )}
        
        {data.episode.type === "QUIZ" && (
          <QuizPlayer 
            content={data.episode.content as QuizContent} 
            onComplete={(score, answers) => handleComplete(score, { answers })}
          />
        )}
        
        {data.episode.type === "EVIDENCE" && (
          <EvidencePlayer 
            content={data.episode.content as EvidenceContent} 
            onComplete={(score) => handleComplete(score)}
          />
        )}
        
        {data.episode.type === "INTERROGATION" && (
          <InterrogationPlayer 
            content={data.episode.content as InterrogationContent} 
            onComplete={(answers) => handleComplete(100, { answers })}
          />
        )}
        
        {data.episode.type === "DEDUCTION" && (
          <DeductionPlayer 
            suspects={suspects}
            onComplete={(suspectId) => handleComplete(100, { suspectChoiceId: suspectId })}
          />
        )}
      </div>
    </div>
  );
}
