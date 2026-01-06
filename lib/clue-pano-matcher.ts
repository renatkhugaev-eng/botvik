/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CLUE PANO MATCHER
 * Единственный источник истины для проверки доступности улики в панораме
 * 
 * Используется в:
 * - useClueDiscovery
 * - useProximityAudio
 * - useDetectiveInstinct
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Проверяет, является ли panoId виртуальным (STEP_N, START и т.д.)
 */
export function isVirtualPanoId(panoId: string): boolean {
  return (
    panoId === "START" ||
    panoId === "ANY" ||
    panoId.startsWith("STEP_")
  );
}

/**
 * Проверяет соответствует ли panoId улики текущей панораме
 * 
 * Поддерживаемые форматы:
 * 
 * ВИРТУАЛЬНЫЕ (для демо-миссий):
 * - "START" → шаг 0
 * - "STEP_N" → точно шаг N (например "STEP_5" = шаг 5)
 * - "STEP_N+" → шаг N и выше (например "STEP_10+" = шаг 10+)
 * - "STEP_N-M" → диапазон шагов (например "STEP_5-10" = шаги 5-10)
 * - "ANY" → любой шаг
 * 
 * РЕАЛЬНЫЕ (для сгенерированных миссий):
 * - Любой другой ID — точное совпадение с currentPanoId
 */
export function matchesPanoId(
  cluePanoId: string,
  currentPanoId: string | null,
  stepCount: number
): boolean {
  // Виртуальные panoId (демо-миссии)
  if (isVirtualPanoId(cluePanoId)) {
    // Специальные значения
    if (cluePanoId === "START") return stepCount === 0;
    if (cluePanoId === "ANY") return true;
    
    // Проверяем формат STEP_N-M (диапазон)
    const rangeMatch = cluePanoId.match(/^STEP_(\d+)-(\d+)$/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      return stepCount >= min && stepCount <= max;
    }
    
    // Проверяем формат STEP_N+ (N и выше)
    const plusMatch = cluePanoId.match(/^STEP_(\d+)\+$/);
    if (plusMatch) {
      const min = parseInt(plusMatch[1], 10);
      return stepCount >= min;
    }
    
    // Проверяем формат STEP_N (точный шаг)
    const exactMatch = cluePanoId.match(/^STEP_(\d+)$/);
    if (exactMatch) {
      const exact = parseInt(exactMatch[1], 10);
      return stepCount === exact;
    }
    
    return false;
  }
  
  // Реальные panoId (сгенерированные миссии) — точное совпадение
  return cluePanoId === currentPanoId;
}

/**
 * Проверяет доступна ли улика в текущей панораме
 * Удобная обёртка для проверки с объектом улики
 */
export function isClueAvailable(
  clue: { panoId: string },
  currentPanoId: string | null,
  stepCount: number
): boolean {
  return matchesPanoId(clue.panoId, currentPanoId, stepCount);
}

