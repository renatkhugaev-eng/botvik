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

// ══════════════════════════════════════════════════════════════════════════════
// ПРЕДУСТАНОВЛЕННЫЕ ДОКУМЕНТЫ ДЛЯ "ЛЕСОПОЛОСА"
// ══════════════════════════════════════════════════════════════════════════════

export const LESOPOLOSA_DOCUMENTS: Record<string, InvestigationDocument> = {
  autopsy_first: {
    id: "autopsy_first",
    type: "autopsy",
    title: "Акт судебно-медицинского исследования",
    subtitle: "Тело неизвестной девочки, ~9 лет",
    date: "25.12.1978",
    classification: "секретно",
    content: `МИНИСТЕРСТВО ЗДРАВООХРАНЕНИЯ РСФСР
Бюро судебно-медицинской экспертизы
г. Шахты, Ростовской области

АКТ № 847/78

НАРУЖНЫЙ ОСМОТР:
Труп девочки, на вид 8-10 лет, правильного телосложения, 
удовлетворительного питания. Длина тела 128 см.

Трупные пятна багрово-фиолетовые, расположены 
на задней поверхности тела.

ТЕЛЕСНЫЕ ПОВРЕЖДЕНИЯ:
1. Множественные колото-резаные раны в области 
   груди и живота — не менее 22 повреждений
2. Следы удушения — борозда на шее
3. Повреждения глаз — [ДАННЫЕ ИЗЪЯТЫ]

ОСОБЫЕ ОТМЕТКИ:
Характер повреждений указывает на ритуальный 
характер действий. Орудие — нож с односторонней 
заточкой, длина лезвия ~15 см.

Подпись: _________________
         судмедэксперт Головань В.И.`,
    signedBy: "Головань В.И., судмедэксперт",
    stampText: "СЕКРЕТНО",
    highlights: [
      {
        id: "wounds_count",
        x: 5,
        y: 55,
        width: 90,
        height: 8,
        label: "Важно: количество ран",
        clueId: "wounds_pattern",
      },
      {
        id: "ritual_note",
        x: 5,
        y: 73,
        width: 90,
        height: 8,
        label: "Ритуальный характер",
        clueId: "signature",
      },
    ],
  },

  witness_first: {
    id: "witness_first",
    type: "witness",
    title: "Протокол допроса свидетеля",
    subtitle: "Показания местной жительницы",
    date: "26.12.1978",
    content: `ПРОТОКОЛ ДОПРОСА СВИДЕТЕЛЯ

Я, следователь Фетисов В.П., допросил в качестве 
свидетеля гр. Петрову Анну Ивановну, 1935 г.р., 
проживающую: г. Шахты, ул. Ленина, д. 47.

ПОКАЗАНИЯ:
"22 декабря, около 16:00, я возвращалась с рынка 
по тропинке вдоль лесополосы. Было уже темно.

Я заметила мужчину, который шёл быстрым шагом 
в сторону станции. На нём было тёмное пальто, 
похоже, серое или коричневое. Шапка-ушанка.

Возраст — лет 40-50. Рост выше среднего. 
Походка немного странная, сутулится.

В руках он нёс какой-то свёрток или сумку.
Показался мне подозрительным, но я не 
придала значения..."

С моих слов записано верно, мною прочитано.
Подпись: _______________ (Петрова А.И.)`,
    signedBy: "Следователь Фетисов В.П.",
    highlights: [
      {
        id: "coat_desc",
        x: 5,
        y: 48,
        width: 90,
        height: 10,
        label: "Описание одежды",
        clueId: "grey_coat_fibers",
      },
      {
        id: "station_dir",
        x: 5,
        y: 38,
        width: 90,
        height: 8,
        label: "Направление — станция",
        clueId: "railway_connection",
      },
    ],
  },

  blood_analysis: {
    id: "blood_analysis",
    type: "evidence",
    title: "Заключение биологической экспертизы",
    subtitle: "Исследование группы крови",
    date: "28.12.1978",
    classification: "для_служебного_пользования",
    content: `ЗАКЛЮЧЕНИЕ ЭКСПЕРТА № 127-Б/78

На исследование поступило:
1. Образец крови подозреваемого Кравченко А.П.
2. Образцы биоматериала с места преступления

РЕЗУЛЬТАТЫ:

Образец №1 (Кравченко А.П.):
  Группа крови: AB (IV)
  Резус-фактор: положительный

Образец №2 (с места преступления):
  Группа крови: A (II)
  Резус-фактор: положительный

ВЫВОД:
Группа крови подозреваемого НЕ СОВПАДАЕТ
с образцами биоматериала, обнаруженными 
на месте преступления.

ПРИМЕЧАНИЕ:
Данное несовпадение может указывать на 
необходимость проверки иных подозреваемых.

Эксперт: Белкина Н.С.`,
    signedBy: "Эксперт-криминалист Белкина Н.С.",
    stampText: "ДСП",
    highlights: [
      {
        id: "blood_mismatch",
        x: 5,
        y: 58,
        width: 90,
        height: 12,
        label: "Несовпадение!",
        clueId: "blood_mismatch_k",
      },
    ],
  },

  newspaper_molot: {
    id: "newspaper_molot",
    type: "newspaper",
    title: 'Газета "Молот"',
    subtitle: "Вырезка объявления о вакансии",
    date: "Ноябрь 1978",
    content: `═══════════════════════════════════════
         ОБЪЯВЛЕНИЯ
═══════════════════════════════════════

    ТРЕБУЕТСЯ СНАБЖЕНЕЦ

Ростсельмаш объявляет набор на должность 
снабженца для работы в районах области.

Требования:
• Мужчина 30-50 лет
• Опыт работы с документацией
• Готовность к командировкам

Оклад по договорённости.
Обращаться: ул. Заводская, 12

═══════════════════════════════════════

[Найдено на месте преступления, 
 в кармане пальто неизвестного]`,
    highlights: [
      {
        id: "job_snabzhenets",
        x: 10,
        y: 22,
        width: 80,
        height: 35,
        label: "Снабженец — командировки!",
        clueId: "job_snabzhenets",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ЭПИЗОД 2: ЛОЖНЫЙ СЛЕД
  // ═══════════════════════════════════════════════════════════════════════════

  timeline_analysis: {
    id: "timeline_analysis",
    type: "evidence",
    title: "Хронология событий 22.12.1978",
    subtitle: "Анализ временных рамок",
    date: "Январь 1979",
    classification: "секретно",
    content: `ХРОНОЛОГИЯ 22 ДЕКАБРЯ 1978

14:00 — Лена выходит из школы
        Свидетели: одноклассники

14:15 — Последний раз видели живой
        Свидетельница Петрова А.И.
        Остановка автобуса

15:00-15:30 — Кравченко у магазина
        Свидетельница Козлова М.П.
        Покупал водку юбилейными монетами

≈16:00 — Предположительное время смерти
        По заключению эксперта

═══════════════════════════════════════

РАССТОЯНИЯ:
• Школа → место преступления: 1.2 км
• Дом Кравченко → место преступления: 2.1 км
• Магазин → дом Кравченко: 400 м

ВЫВОД:
Временное окно — менее часа.
При расстоянии 2.1 км + время убийства 
физически маловероятно.`,
    signedBy: "Следователь Фетисов В.П.",
    stampText: "СЕКРЕТНО",
    highlights: [
      {
        id: "timeline_gap",
        x: 5,
        y: 20,
        width: 90,
        height: 30,
        label: "Временные нестыковки",
        clueId: "timeline_gap",
      },
      {
        id: "coin_evidence",
        x: 5,
        y: 40,
        width: 90,
        height: 10,
        label: "Алиби — монеты",
        clueId: "coin_alibi",
      },
    ],
  },

  case_files: {
    id: "case_files",
    type: "case",
    title: "Материалы уголовного дела",
    subtitle: "Протокол осмотра тела",
    date: "24.12.1978",
    classification: "секретно",
    content: `ПРОТОКОЛ ОСМОТРА ТРУПА

Обнаружено: лесополоса вблизи р. Грушевка
Дата: 24 декабря 1978 г.
Время: 09:15

ОПИСАНИЕ:
Тело девочки 8-10 лет. Одежда частично 
отсутствует. 

ПОВРЕЖДЕНИЯ:
• Множественные колото-резаные раны
• Повреждения области глаз
• СЛЕДЫ УКУСОВ на теле

═══════════════════════════════════════

ВАЖНО:
При допросе подозреваемого Кравченко А.П.
он НЕ УПОМЯНУЛ следы укусов.

Если бы он совершил преступление —
он бы знал об этой детали.

═══════════════════════════════════════

Вывод: расхождение показаний с 
материалами дела.`,
    signedBy: "Судмедэксперт Иванов С.К.",
    stampText: "СЕКРЕТНО",
    highlights: [
      {
        id: "bite_marks",
        x: 5,
        y: 45,
        width: 90,
        height: 8,
        label: "Следы укусов — ключевая деталь",
        clueId: "missing_detail",
      },
    ],
  },

  confession_protocol: {
    id: "confession_protocol",
    type: "interrogation",
    title: "Протокол допроса",
    subtitle: "Признательные показания Кравченко А.П.",
    date: "15.01.1979",
    classification: "для_служебного_пользования",
    content: `ПРОТОКОЛ ДОПРОСА

Подозреваемый: Кравченко А.П., 1952 г.р.
Дата: 15 января 1979 г.
Время: 03:40 (ночь)

═══════════════════════════════════════

ПОКАЗАНИЯ:
"Я... признаю, что совершил это... 
Я убил девочку... Больше не бейте..."

[Подпись неразборчива]

═══════════════════════════════════════

ПРИМЕЧАНИЕ СЛЕДОВАТЕЛЯ:
Признание получено после 18 часов допроса.
Подозреваемый находился в состоянии 
крайнего истощения.

На теле Кравченко зафиксированы гематомы
неустановленного происхождения.

═══════════════════════════════════════

ВОПРОСЫ:
• Время допроса: 18+ часов
• Состояние подозреваемого: истощён
• Признание без деталей (укусы?)`,
    signedBy: "Следователь [подпись]",
    stampText: "ДСП",
    highlights: [
      {
        id: "forced_methods_highlight",
        x: 5,
        y: 65,
        width: 90,
        height: 20,
        label: "Признаки давления",
        clueId: "forced_confession",
      },
    ],
  },

  serial_cases: {
    id: "serial_cases",
    type: "case",
    title: "Нераскрытые дела (1971-1978)",
    subtitle: "Сводка похожих преступлений",
    date: "Февраль 1979",
    classification: "секретно",
    content: `СЕКРЕТНАЯ СВОДКА

НЕРАСКРЫТЫЕ ДЕЛА С ПОХОЖИМ ПОЧЕРКОМ

═══════════════════════════════════════

1971 — Новошахтинск
       Исчезновение девочки 10 лет
       Тело не найдено

1973 — пос. Донской
       Убийство мальчика 12 лет
       Множественные ножевые ранения

1975 — Аксай
       Обнаружено тело, личность 
       не установлена

1977 — Шахты
       Убийство мальчика 9 лет
       Тело в лесополосе

═══════════════════════════════════════

ОБЩИЕ ПРИЗНАКИ:
• Жертвы: дети 8-15 лет
• Множественные ножевые ранения
• Тела в лесополосах
• Связь с ж/д станциями

ВАЖНО:
Кравченко А.П. находился в заключении
с 1971 по 1977 год.

ОН НЕ МОГ СОВЕРШИТЬ ЭТИ ПРЕСТУПЛЕНИЯ.`,
    signedBy: "Аналитический отдел",
    stampText: "СЕКРЕТНО",
    highlights: [
      {
        id: "serial_pattern_highlight",
        x: 5,
        y: 75,
        width: 90,
        height: 15,
        label: "Серийный убийца?",
        clueId: "serial_pattern",
      },
    ],
  },
};

export default DocumentViewer;
