"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import Image from "next/image";
import { investigationHaptic } from "@/lib/haptic";

// ══════════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════════════════════

export type DocumentType = 
  | "autopsy"       // Протокол вскрытия
  | "witness"       // Показания свидетеля
  | "evidence"      // Опись улик
  | "photo"         // Фотография с места преступления
  | "map"           // Карта/схема
  | "letter"        // Письмо/записка
  | "report"        // Рапорт/отчёт
  | "newspaper"     // Газетная вырезка
  | "idcard"        // Удостоверение личности
  | "case"          // Материалы дела
  | "interrogation"; // Протокол допроса

export interface DocumentHighlight {
  id: string;
  x: number;      // % от ширины
  y: number;      // % от высоты
  width: number;  // % от ширины
  height: number; // % от высоты
  label?: string;
  clueId?: string; // ID улики, которая открывается при клике
}

export interface InvestigationDocument {
  id: string;
  type: DocumentType;
  title: string;
  subtitle?: string;
  date?: string;
  classification?: "секретно" | "совершенно_секретно" | "для_служебного_пользования";
  imageSrc?: string;
  content?: string;        // Текстовое содержимое (для документов без изображения)
  highlights?: DocumentHighlight[];
  signedBy?: string;
  stampText?: string;
}

type DocumentViewerProps = {
  document: InvestigationDocument;
  onClose: () => void;
  onHighlightClick?: (highlight: DocumentHighlight) => void;
  onClueDiscovered?: (clueId: string) => void;
};

// ══════════════════════════════════════════════════════════════════════════════
// КОНСТАНТЫ
// ══════════════════════════════════════════════════════════════════════════════

const DOCUMENT_STYLES: Record<DocumentType, {
  bgColor: string;
  borderColor: string;
  headerBg: string;
  fontClass: string;
  paperTexture: boolean;
}> = {
  autopsy: {
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    headerBg: "bg-amber-100",
    fontClass: "font-mono",
    paperTexture: true,
  },
  witness: {
    bgColor: "bg-stone-100",
    borderColor: "border-stone-300",
    headerBg: "bg-stone-200",
    fontClass: "font-serif",
    paperTexture: true,
  },
  evidence: {
    bgColor: "bg-slate-100",
    borderColor: "border-slate-300",
    headerBg: "bg-slate-200",
    fontClass: "font-mono",
    paperTexture: true,
  },
  photo: {
    bgColor: "bg-neutral-900",
    borderColor: "border-neutral-700",
    headerBg: "bg-neutral-800",
    fontClass: "font-sans",
    paperTexture: false,
  },
  map: {
    bgColor: "bg-amber-100",
    borderColor: "border-amber-300",
    headerBg: "bg-amber-200",
    fontClass: "font-sans",
    paperTexture: true,
  },
  letter: {
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    headerBg: "bg-yellow-100",
    fontClass: "font-serif italic",
    paperTexture: true,
  },
  report: {
    bgColor: "bg-gray-100",
    borderColor: "border-gray-300",
    headerBg: "bg-gray-200",
    fontClass: "font-mono",
    paperTexture: true,
  },
  newspaper: {
    bgColor: "bg-yellow-100",
    borderColor: "border-yellow-300",
    headerBg: "bg-yellow-200",
    fontClass: "font-serif",
    paperTexture: true,
  },
  idcard: {
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    headerBg: "bg-red-100",
    fontClass: "font-mono",
    paperTexture: false,
  },
  case: {
    bgColor: "bg-stone-100",
    borderColor: "border-stone-400",
    headerBg: "bg-stone-300",
    fontClass: "font-mono",
    paperTexture: true,
  },
  interrogation: {
    bgColor: "bg-amber-50",
    borderColor: "border-amber-300",
    headerBg: "bg-amber-200",
    fontClass: "font-mono",
    paperTexture: true,
  },
};

const CLASSIFICATION_STYLES: Record<string, string> = {
  секретно: "bg-red-600 text-white",
  совершенно_секретно: "bg-red-800 text-white",
  для_служебного_пользования: "bg-blue-600 text-white",
};

// ══════════════════════════════════════════════════════════════════════════════
// ОСНОВНОЙ КОМПОНЕНТ
// ══════════════════════════════════════════════════════════════════════════════

export function DocumentViewer({
  document,
  onClose,
  onHighlightClick,
  onClueDiscovered,
}: DocumentViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showHighlights, setShowHighlights] = useState(true);
  const [discoveredHighlights, setDiscoveredHighlights] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const style = DOCUMENT_STYLES[document.type];

  // Haptic при открытии
  useEffect(() => {
    investigationHaptic.sceneTransition();
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // ОБРАБОТЧИКИ ЗУМА
  // ══════════════════════════════════════════════════════════════════════════

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 3));
    investigationHaptic.evidenceSelect();
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
    investigationHaptic.evidenceSelect();
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    investigationHaptic.sceneTransition();
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // ОБРАБОТЧИКИ DRAG
  // ══════════════════════════════════════════════════════════════════════════

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      setIsDragging(false);
      setPosition((prev) => ({
        x: prev.x + info.offset.x,
        y: prev.y + info.offset.y,
      }));
    },
    []
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ОБРАБОТКА КЛИКА НА HIGHLIGHT
  // ══════════════════════════════════════════════════════════════════════════

  const handleHighlightClick = useCallback(
    (highlight: DocumentHighlight) => {
      investigationHaptic.clueDiscovered();
      
      setDiscoveredHighlights((prev) => new Set(prev).add(highlight.id));
      
      if (highlight.clueId) {
        onClueDiscovered?.(highlight.clueId);
      }
      
      onHighlightClick?.(highlight);
    },
    [onHighlightClick, onClueDiscovered]
  );

  // ══════════════════════════════════════════════════════════════════════════
  // РЕНДЕР
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Хедер */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white">{document.title}</h2>
          {document.subtitle && (
            <p className="text-sm text-white/60">{document.subtitle}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Кнопки зума */}
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20"
          >
            −
          </button>
          <span className="text-xs text-white/50 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20"
          >
            +
          </button>
          <button
            onClick={handleResetZoom}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 ml-1"
            title="Сбросить"
          >
            ⟲
          </button>
          
          {/* Показать/скрыть подсветку */}
          {document.highlights && document.highlights.length > 0 && (
            <button
              onClick={() => setShowHighlights((prev) => !prev)}
              className={`ml-2 w-8 h-8 rounded-lg flex items-center justify-center ${
                showHighlights ? "bg-violet-500/30 text-violet-300" : "bg-white/10 text-white/50"
              }`}
              title="Подсветка улик"
            >
              💡
            </button>
          )}
          
          {/* Закрыть */}
          <button
            onClick={onClose}
            className="ml-2 w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/30"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Основной контент */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative"
      >
        <motion.div
          drag
          dragConstraints={containerRef}
          dragElastic={0.1}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          style={{
            x: position.x,
            y: position.y,
            scale,
          }}
          className={`absolute inset-0 m-auto w-fit h-fit max-w-[90vw] max-h-[70vh] cursor-grab ${
            isDragging ? "cursor-grabbing" : ""
          }`}
        >
          {/* Документ */}
          <div
            className={`relative rounded-lg shadow-2xl overflow-hidden ${style.bgColor} ${style.borderColor} border-2`}
            style={{
              minWidth: "300px",
              maxWidth: "600px",
            }}
          >
            {/* Текстура бумаги */}
            {style.paperTexture && (
              <div 
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                  mixBlendMode: "multiply",
                }}
              />
            )}

            {/* Гриф секретности */}
            {document.classification && (
              <div className="absolute top-2 right-2 z-10">
                <div
                  className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    CLASSIFICATION_STYLES[document.classification]
                  } rotate-[-5deg] shadow-lg`}
                >
                  {document.classification.replace("_", " ")}
                </div>
              </div>
            )}

            {/* Заголовок документа */}
            <div className={`${style.headerBg} px-4 py-3 border-b ${style.borderColor}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                    {getDocumentTypeLabel(document.type)}
                  </div>
                  <div className={`text-sm font-semibold text-gray-800 ${style.fontClass}`}>
                    {document.title}
                  </div>
                </div>
                {document.date && (
                  <div className="text-xs text-gray-500">{document.date}</div>
                )}
              </div>
            </div>

            {/* Содержимое */}
            <div className="relative">
              {/* Изображение */}
              {document.imageSrc && (
                <div className="relative">
                  <Image
                    src={document.imageSrc}
                    alt={document.title}
                    width={600}
                    height={800}
                    className="w-full h-auto"
                    style={{ 
                      filter: document.type === "photo" ? "sepia(0.3) contrast(1.1)" : "sepia(0.1)",
                    }}
                  />
                  
                  {/* Highlights */}
                  {showHighlights && document.highlights?.map((highlight) => (
                    <HighlightOverlay
                      key={highlight.id}
                      highlight={highlight}
                      isDiscovered={discoveredHighlights.has(highlight.id)}
                      onClick={() => handleHighlightClick(highlight)}
                    />
                  ))}
                </div>
              )}

              {/* Текстовое содержимое */}
              {document.content && (
                <div className={`p-4 text-sm text-gray-800 leading-relaxed ${style.fontClass}`}>
                  <div className="whitespace-pre-line">{document.content}</div>
                </div>
              )}
            </div>

            {/* Подпись */}
            {document.signedBy && (
              <div className={`px-4 py-3 border-t ${style.borderColor}`}>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">Подписано:</div>
                  <div className="text-sm font-medium text-gray-700 italic">
                    {document.signedBy}
                  </div>
                </div>
              </div>
            )}

            {/* Штамп */}
            {document.stampText && (
              <div className="absolute bottom-4 right-4 transform rotate-[-15deg]">
                <div className="border-4 border-red-700/60 rounded-lg px-3 py-1 text-red-700/60 font-bold text-sm uppercase">
                  {document.stampText}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Подсказка */}
      <div className="p-4 border-t border-white/10 text-center">
        <p className="text-xs text-white/40">
          Перетащите для перемещения • Используйте кнопки ± для зума
          {document.highlights && document.highlights.length > 0 && (
            <> • Нажмите на подсвеченные области для обнаружения улик</>
          )}
        </p>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ ПОДСВЕТКИ
// ══════════════════════════════════════════════════════════════════════════════

function HighlightOverlay({
  highlight,
  isDiscovered,
  onClick,
}: {
  highlight: DocumentHighlight;
  isDiscovered: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ 
        opacity: isDiscovered ? 0.3 : 1,
        scale: isDiscovered ? 1 : [1, 1.02, 1],
      }}
      transition={{ 
        scale: { 
          duration: 2, 
          repeat: isDiscovered ? 0 : Infinity,
          ease: "easeInOut",
        },
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDiscovered) onClick();
      }}
      disabled={isDiscovered}
      className={`absolute cursor-pointer transition-all ${
        isDiscovered 
          ? "border-2 border-emerald-400/50 bg-emerald-400/10" 
          : "border-2 border-violet-400/70 bg-violet-400/20 hover:bg-violet-400/30"
      }`}
      style={{
        left: `${highlight.x}%`,
        top: `${highlight.y}%`,
        width: `${highlight.width}%`,
        height: `${highlight.height}%`,
      }}
    >
      {/* Лейбл */}
      {highlight.label && !isDiscovered && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <div className="px-2 py-0.5 bg-violet-500 text-white text-[10px] rounded shadow-lg">
            {highlight.label}
          </div>
        </div>
      )}
      
      {/* Иконка обнаружения */}
      {isDiscovered && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-emerald-400 text-xl">✓</span>
        </div>
      )}
    </motion.button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ══════════════════════════════════════════════════════════════════════════════

function getDocumentTypeLabel(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    autopsy: "Протокол вскрытия",
    witness: "Показания свидетеля",
    evidence: "Опись вещественных доказательств",
    photo: "Фотоматериал",
    map: "Схема / Карта",
    letter: "Документ",
    report: "Служебная записка",
    newspaper: "Газетная вырезка",
    idcard: "Удостоверение личности",
    case: "Материалы уголовного дела",
    interrogation: "Протокол допроса",
  };
  return labels[type];
}

// Пустой объект — документы будут добавляться динамически под конкретные истории
export const DOCUMENTS: Record<string, InvestigationDocument> = {};

export default DocumentViewer;
