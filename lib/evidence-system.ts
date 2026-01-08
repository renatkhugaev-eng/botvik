/**
 * ══════════════════════════════════════════════════════════════════════════════
 * EVIDENCE BOARD SYSTEM — Профессиональная система улик
 * ══════════════════════════════════════════════════════════════════════════════
 */

// ══════════════════════════════════════════════════════════════════════════════
// ТИПЫ УЛИК
// ══════════════════════════════════════════════════════════════════════════════

export type EvidenceCategory = 
  | "physical"      // Физические улики (кровь, волокна, следы)
  | "witness"       // Свидетельские показания
  | "document"      // Документы (справки, протоколы)
  | "suspect"       // Информация о подозреваемых
  | "location"      // Места преступлений
  | "timeline"      // Временные данные
  | "forensic"      // Криминалистика
  | "profile";      // Психологический профиль

export type EvidenceImportance = "critical" | "major" | "minor" | "red_herring";

export type Evidence = {
  id: string;
  title: string;
  description: string;
  category: EvidenceCategory;
  importance: EvidenceImportance;
  icon: string;
  foundAt: string;           // ID сцены где найдена
  timestamp?: string;        // Игровое время находки
  imageUrl?: string;         // Картинка улики
  details?: string[];        // Дополнительные детали
  connectedTo?: string[];    // ID связанных улик
  isRevealed: boolean;       // Показана ли полная информация
  revealedBy?: string[];     // Какие связи раскрывают эту улику
};

export type EvidenceConnection = {
  id: string;
  from: string;              // ID улики
  to: string;                // ID улики
  label: string;             // Описание связи
  isCorrect: boolean;        // Правильная ли связь
  discoveredAt?: string;     // Когда обнаружена
  insight?: string;          // Что даёт эта связь
  points: number;            // Очки за связь
};

export type Suspect = {
  id: string;
  name: string;
  codename?: string;         // Кодовое имя (для завуалированности)
  age: number;
  occupation: string;
  description: string;
  photoUrl?: string;
  status: "unknown" | "person_of_interest" | "suspect" | "arrested" | "cleared" | "convicted";
  alibi?: string;
  evidence: string[];        // ID улик, связанных с подозреваемым
  guiltyScore: number;       // 0-100, насколько виновен по уликам
};

export type BoardState = {
  evidence: Evidence[];
  connections: EvidenceConnection[];
  suspects: Suspect[];
  currentFocus?: string;     // ID текущей фокусной улики
  totalScore: number;
  correctConnections: number;
  wrongConnections: number;
  insights: string[];        // Раскрытые инсайты
};

// ══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ РАБОТЫ С ДОСКОЙ
// ══════════════════════════════════════════════════════════════════════════════

export function createInitialBoardState(): BoardState {
  return {
    evidence: [],
    connections: [],
    suspects: [],
    totalScore: 0,
    correctConnections: 0,
    wrongConnections: 0,
    insights: [],
  };
}

export function addEvidence(state: BoardState, evidenceId: string, evidenceData?: Evidence): BoardState {
  // Если улика уже есть — не добавляем
  if (state.evidence.some((e) => e.id === evidenceId)) {
    return state;
  }

  // Если переданы данные — добавляем их
  if (evidenceData) {
    return {
      ...state,
      evidence: [...state.evidence, { ...evidenceData }],
    };
  }

  // Иначе возвращаем без изменений (улика не найдена)
  return state;
}

export function tryConnection(
  state: BoardState,
  fromId: string,
  toId: string,
  correctConnections: EvidenceConnection[] = [],
  wrongConnections: EvidenceConnection[] = []
): { newState: BoardState; result: "correct" | "wrong" | "duplicate" | "invalid" } {
  // Проверяем, есть ли уже такая связь
  const existingConnection = state.connections.find(
    (c) => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
  );
  if (existingConnection) {
    return { newState: state, result: "duplicate" };
  }

  // Проверяем, есть ли обе улики
  const fromEvidence = state.evidence.find((e) => e.id === fromId);
  const toEvidence = state.evidence.find((e) => e.id === toId);
  if (!fromEvidence || !toEvidence) {
    return { newState: state, result: "invalid" };
  }

  // Ищем правильную связь
  const correctConnection = correctConnections.find(
    (c) => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
  );

  if (correctConnection) {
    return {
      newState: {
        ...state,
        connections: [...state.connections, { ...correctConnection, discoveredAt: new Date().toISOString() }],
        totalScore: state.totalScore + correctConnection.points,
        correctConnections: state.correctConnections + 1,
        insights: correctConnection.insight 
          ? [...state.insights, correctConnection.insight]
          : state.insights,
      },
      result: "correct",
    };
  }

  // Ищем неправильную связь
  const wrongConnection = wrongConnections.find(
    (c) => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
  );

  if (wrongConnection) {
    return {
      newState: {
        ...state,
        connections: [...state.connections, { ...wrongConnection, discoveredAt: new Date().toISOString() }],
        totalScore: state.totalScore + wrongConnection.points,
        wrongConnections: state.wrongConnections + 1,
      },
      result: "wrong",
    };
  }

  // Нейтральная связь (не правильная, не ложная)
  return { newState: state, result: "invalid" };
}

export function getEvidenceByCategory(state: BoardState, category: EvidenceCategory): Evidence[] {
  return state.evidence.filter((e) => e.category === category);
}

export function calculateProgress(state: BoardState, totalCorrectConnections: number = 1): number {
  if (totalCorrectConnections === 0) return 0;
  return Math.round((state.correctConnections / totalCorrectConnections) * 100);
}

export function getSuspectGuiltScore(state: BoardState, suspectId: string): number {
  const suspect = state.suspects.find((s) => s.id === suspectId);
  if (!suspect) return 0;

  // Базовый счёт
  let score = suspect.guiltyScore;

  // Корректируем по найденным связям
  state.connections.forEach((conn) => {
    if (conn.isCorrect) {
      // Проверяем, связана ли эта связь с уликами подозреваемого
      const isRelatedToSuspect = 
        suspect.evidence.includes(conn.from) || 
        suspect.evidence.includes(conn.to);
      
      if (isRelatedToSuspect) {
        score += 5;
      }
    } else {
      // Неправильные связи снижают подозрения если связаны с подозреваемым
      const isRelatedToSuspect = 
        suspect.evidence.includes(conn.from) || 
        suspect.evidence.includes(conn.to);
      
      if (isRelatedToSuspect) {
        score -= 10;
      }
    }
  });

  return Math.min(100, Math.max(0, score));
}
