/**
 * ══════════════════════════════════════════════════════════════════════════════
 * INK VALIDATOR SCRIPT
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Профессиональная проверка .ink файлов на ошибки и несоответствия
 * 
 * Использование:
 *   npx ts-node scripts/validate-ink.ts
 *   npx ts-node scripts/validate-ink.ts content/investigations/episode2-false-trail.ink
 */

import * as fs from "fs";
import * as path from "path";

const INVESTIGATIONS_DIR = path.join(process.cwd(), "content", "investigations");

// ══════════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════════════════════

interface ValidationResult {
  file: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  stats: InkStats;
}

interface ValidationIssue {
  type: string;
  message: string;
  line?: number;
  context?: string;
}

interface InkStats {
  knots: number;
  functions: number;
  variables: number;
  choices: number;
  diverts: number;
  tunnels: number;
  endings: number;
  clues: number;
}

interface KnotInfo {
  name: string;
  line: number;
  isFunction: boolean;
  isTunnel: boolean;
  hasReturn: boolean;
  choices: number;
  diverts: string[];
  incomingDiverts: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// ВАЛИДАТОР
// ══════════════════════════════════════════════════════════════════════════════

function validateInkFile(inkPath: string): ValidationResult {
  const content = fs.readFileSync(inkPath, "utf-8");
  const lines = content.split("\n");
  
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];
  
  // Собираем информацию
  const knots = new Map<string, KnotInfo>();
  const variables = new Set<string>();
  const clues = new Set<string>();
  let totalChoices = 0;
  let totalDiverts = 0;
  let totalTunnels = 0;
  
  let currentKnot = "";
  let openBrackets = 0;
  let inFunction = false;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ПЕРВЫЙ ПРОХОД: Собираем определения
  // ═══════════════════════════════════════════════════════════════════════════
  
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();
    
    // Пропускаем комментарии
    if (trimmed.startsWith("//")) return;
    
    // VAR объявления
    const varMatch = trimmed.match(/^VAR\s+(\w+)\s*=/);
    if (varMatch) {
      variables.add(varMatch[1]);
    }
    
    // Knot определения
    const knotMatch = trimmed.match(/^===\s*(?:function\s+)?(\w+)\s*(?:\(.*\))?\s*===?\s*$/);
    if (knotMatch) {
      const name = knotMatch[1];
      const isFunc = trimmed.includes("function");
      currentKnot = name;
      inFunction = isFunc;
      
      knots.set(name, {
        name,
        line: lineNum,
        isFunction: isFunc,
        isTunnel: false,
        hasReturn: false,
        choices: 0,
        diverts: [],
        incomingDiverts: 0,
      });
    }
    
    // Проверяем return в функциях
    if (trimmed.startsWith("~ return") && currentKnot) {
      const knotInfo = knots.get(currentKnot);
      if (knotInfo) {
        knotInfo.hasReturn = true;
      }
    }
    
    // Проверяем ->-> (возврат из туннеля)
    if (trimmed === "->->") {
      const knotInfo = knots.get(currentKnot);
      if (knotInfo) {
        knotInfo.isTunnel = true;
      }
    }
    
    // Считаем выборы
    if (trimmed.startsWith("*") || trimmed.startsWith("+")) {
      totalChoices++;
      const knotInfo = knots.get(currentKnot);
      if (knotInfo) {
        knotInfo.choices++;
      }
    }
    
    // Собираем diverts
    const divertMatches = [...trimmed.matchAll(/->\s*(\w+)(?:\s*->)?/g)];
    for (const match of divertMatches) {
      const target = match[1];
      if (target !== ">" && target !== "->") { // Исключаем ->->
        totalDiverts++;
        const knotInfo = knots.get(currentKnot);
        if (knotInfo && !knotInfo.diverts.includes(target)) {
          knotInfo.diverts.push(target);
        }
        
        // Проверяем туннельный вызов
        if (match[0].endsWith("->") && !match[0].includes("->>")) {
          totalTunnels++;
        }
      }
    }
    
    // Собираем clue теги
    const clueMatch = trimmed.match(/^#\s*clue:\s*(\w+)/);
    if (clueMatch) {
      clues.add(clueMatch[1]);
    }
  });
  
  // Добавляем встроенные knots
  knots.set("END", { name: "END", line: 0, isFunction: false, isTunnel: false, hasReturn: false, choices: 0, diverts: [], incomingDiverts: 0 });
  knots.set("DONE", { name: "DONE", line: 0, isFunction: false, isTunnel: false, hasReturn: false, choices: 0, diverts: [], incomingDiverts: 0 });
  
  // Считаем входящие diverts
  knots.forEach((knotInfo) => {
    knotInfo.diverts.forEach((target) => {
      const targetKnot = knots.get(target);
      if (targetKnot) {
        targetKnot.incomingDiverts++;
      }
    });
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ВТОРОЙ ПРОХОД: Проверки
  // ═══════════════════════════════════════════════════════════════════════════
  
  currentKnot = "";
  openBrackets = 0;
  
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();
    
    // Пропускаем комментарии
    if (trimmed.startsWith("//")) return;
    
    // Обновляем текущий knot
    const knotMatch = trimmed.match(/^===\s*(?:function\s+)?(\w+)/);
    if (knotMatch) {
      currentKnot = knotMatch[1];
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // Проверка 1: Незакрытые скобки в выборах
    // ─────────────────────────────────────────────────────────────────────────
    if (trimmed.startsWith("*") || trimmed.startsWith("+")) {
      const bracketOpen = (trimmed.match(/\[/g) || []).length;
      const bracketClose = (trimmed.match(/\]/g) || []).length;
      if (bracketOpen !== bracketClose) {
        errors.push({
          type: "BRACKET_MISMATCH",
          message: `Несоответствие скобок [] в выборе`,
          line: lineNum,
          context: trimmed.substring(0, 60),
        });
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // Проверка 2: Diverts к несуществующим knots
    // ─────────────────────────────────────────────────────────────────────────
    const divertMatches = [...trimmed.matchAll(/->\s*(\w+)/g)];
    for (const match of divertMatches) {
      const target = match[1];
      if (target !== ">" && !knots.has(target)) {
        errors.push({
          type: "INVALID_DIVERT",
          message: `Переход к несуществующему knot '${target}'`,
          line: lineNum,
          context: trimmed.substring(0, 60),
        });
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // Проверка 3: Туннельные вызовы без возврата
    // ─────────────────────────────────────────────────────────────────────────
    const tunnelMatch = trimmed.match(/->\s*(\w+)\s*->/);
    if (tunnelMatch && !trimmed.includes("->>->")) {
      const tunnelName = tunnelMatch[1];
      const tunnelKnot = knots.get(tunnelName);
      if (tunnelKnot && !tunnelKnot.isTunnel && !tunnelKnot.isFunction) {
        warnings.push({
          type: "TUNNEL_NO_RETURN",
          message: `Туннельный вызов '${tunnelName}' но knot не содержит ->->`,
          line: lineNum,
          context: trimmed.substring(0, 60),
        });
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // Проверка 4: Фигурные скобки
    // ─────────────────────────────────────────────────────────────────────────
    const curlyOpen = (trimmed.match(/\{/g) || []).length;
    const curlyClose = (trimmed.match(/\}/g) || []).length;
    openBrackets += curlyOpen - curlyClose;
    
    // ─────────────────────────────────────────────────────────────────────────
    // Проверка 5: VAR без значения
    // ─────────────────────────────────────────────────────────────────────────
    if (trimmed.startsWith("VAR ") && !trimmed.includes("=")) {
      errors.push({
        type: "VAR_NO_VALUE",
        message: `VAR объявлена без начального значения`,
        line: lineNum,
        context: trimmed,
      });
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // Проверка 6: Пустые выборы
    // ─────────────────────────────────────────────────────────────────────────
    if ((trimmed === "*" || trimmed === "+") && !lines[i + 1]?.trim()) {
      errors.push({
        type: "EMPTY_CHOICE",
        message: `Пустой выбор без текста`,
        line: lineNum,
      });
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // Проверка 7: Выборы внутри inline условий
    // ─────────────────────────────────────────────────────────────────────────
    if (openBrackets > 0 && (trimmed.startsWith("*") || trimmed.startsWith("+"))) {
      warnings.push({
        type: "CHOICE_IN_CONDITIONAL",
        message: `Выбор внутри условного блока (может работать некорректно)`,
        line: lineNum,
        context: trimmed.substring(0, 60),
      });
    }
  });
  
  // ─────────────────────────────────────────────────────────────────────────
  // Проверка 8: Незакрытые фигурные скобки в конце
  // ─────────────────────────────────────────────────────────────────────────
  if (openBrackets !== 0) {
    errors.push({
      type: "UNCLOSED_BRACKETS",
      message: `Незакрытые фигурные скобки: ${openBrackets > 0 ? `не хватает ${openBrackets} '}'` : `лишние ${-openBrackets} '}'`}`,
    });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ПРОВЕРКИ СТРУКТУРЫ
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Проверка 9: Недостижимые knots
  knots.forEach((knotInfo, name) => {
    if (knotInfo.incomingDiverts === 0 && 
        !knotInfo.isFunction && 
        name !== "END" && 
        name !== "DONE" &&
        knotInfo.line > 0) {
      // Проверяем, не первый ли это knot (точка входа)
      const isFirstKnot = [...knots.values()]
        .filter(k => k.line > 0 && !k.isFunction)
        .sort((a, b) => a.line - b.line)[0]?.name === name;
      
      if (!isFirstKnot) {
        warnings.push({
          type: "UNREACHABLE_KNOT",
          message: `Knot '${name}' не имеет входящих переходов (недостижим?)`,
          line: knotInfo.line,
        });
      }
    }
  });
  
  // Проверка 10: Knots без выходов (потенциальные мёртвые концы)
  knots.forEach((knotInfo, name) => {
    if (!knotInfo.isFunction && 
        knotInfo.choices === 0 && 
        knotInfo.diverts.length === 0 &&
        !knotInfo.isTunnel &&
        name !== "END" && 
        name !== "DONE" &&
        knotInfo.line > 0) {
      warnings.push({
        type: "DEAD_END",
        message: `Knot '${name}' не имеет ни выборов, ни переходов (мёртвый конец?)`,
        line: knotInfo.line,
      });
    }
  });
  
  // Проверка 11: Концовки
  const endings = [...knots.values()].filter(k => 
    k.name.includes("ending") || k.diverts.includes("END")
  );
  
  if (endings.length === 0) {
    warnings.push({
      type: "NO_ENDINGS",
      message: `Не найдено knots с концовками (ending или -> END)`,
    });
  } else {
    info.push({
      type: "ENDINGS_FOUND",
      message: `Найдено ${endings.length} концовок: ${endings.map(e => e.name).join(", ")}`,
    });
  }
  
  // Проверка 12: Функции без return
  knots.forEach((knotInfo, name) => {
    if (knotInfo.isFunction && !knotInfo.hasReturn && knotInfo.diverts.length === 0) {
      info.push({
        type: "FUNCTION_NO_RETURN",
        message: `Функция '${name}' не имеет явного return (использует void?)`,
        line: knotInfo.line,
      });
    }
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // СТАТИСТИКА
  // ═══════════════════════════════════════════════════════════════════════════
  
  const stats: InkStats = {
    knots: [...knots.values()].filter(k => !k.isFunction && k.line > 0).length,
    functions: [...knots.values()].filter(k => k.isFunction).length,
    variables: variables.size,
    choices: totalChoices,
    diverts: totalDiverts,
    tunnels: totalTunnels,
    endings: endings.length,
    clues: clues.size,
  };
  
  return {
    file: inkPath,
    errors,
    warnings,
    info,
    stats,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ВЫВОД РЕЗУЛЬТАТОВ
// ══════════════════════════════════════════════════════════════════════════════

function printResult(result: ValidationResult): void {
  const fileName = path.basename(result.file);
  
  console.log(`\n${"═".repeat(70)}`);
  console.log(`📄 ${fileName}`);
  console.log(`${"═".repeat(70)}`);
  
  // Статистика
  console.log(`\n📊 СТАТИСТИКА:`);
  console.log(`   Knots: ${result.stats.knots}`);
  console.log(`   Функции: ${result.stats.functions}`);
  console.log(`   Переменные: ${result.stats.variables}`);
  console.log(`   Выборы: ${result.stats.choices}`);
  console.log(`   Переходы: ${result.stats.diverts}`);
  console.log(`   Туннели: ${result.stats.tunnels}`);
  console.log(`   Концовки: ${result.stats.endings}`);
  console.log(`   Улики: ${result.stats.clues}`);
  
  // Ошибки
  if (result.errors.length > 0) {
    console.log(`\n❌ ОШИБКИ (${result.errors.length}):`);
    result.errors.forEach((e) => {
      const lineInfo = e.line ? ` [строка ${e.line}]` : "";
      console.log(`   • ${e.type}${lineInfo}: ${e.message}`);
      if (e.context) {
        console.log(`     └─ ${e.context}...`);
      }
    });
  }
  
  // Предупреждения
  if (result.warnings.length > 0) {
    console.log(`\n⚠️  ПРЕДУПРЕЖДЕНИЯ (${result.warnings.length}):`);
    result.warnings.forEach((w) => {
      const lineInfo = w.line ? ` [строка ${w.line}]` : "";
      console.log(`   • ${w.type}${lineInfo}: ${w.message}`);
      if (w.context) {
        console.log(`     └─ ${w.context}...`);
      }
    });
  }
  
  // Информация
  if (result.info.length > 0) {
    console.log(`\nℹ️  ИНФОРМАЦИЯ (${result.info.length}):`);
    result.info.forEach((i) => {
      const lineInfo = i.line ? ` [строка ${i.line}]` : "";
      console.log(`   • ${i.type}${lineInfo}: ${i.message}`);
    });
  }
  
  // Итог
  if (result.errors.length === 0) {
    console.log(`\n✅ Файл прошёл валидацию!`);
  } else {
    console.log(`\n❌ Найдено ${result.errors.length} ошибок!`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    INK VALIDATOR                                  ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  
  const targetFile = process.argv[2];
  let filesToValidate: string[] = [];
  
  if (targetFile) {
    const fullPath = path.isAbsolute(targetFile)
      ? targetFile
      : path.join(process.cwd(), targetFile);
    filesToValidate = [fullPath];
  } else {
    if (!fs.existsSync(INVESTIGATIONS_DIR)) {
      console.log("⚠️ Директория content/investigations не найдена");
      return;
    }
    
    const files = fs.readdirSync(INVESTIGATIONS_DIR);
    filesToValidate = files
      .filter((f) => f.endsWith(".ink"))
      .map((f) => path.join(INVESTIGATIONS_DIR, f));
  }
  
  if (filesToValidate.length === 0) {
    console.log("⚠️ Не найдено .ink файлов для проверки");
    return;
  }
  
  console.log(`\n📚 Проверяем ${filesToValidate.length} файл(ов)...`);
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  for (const file of filesToValidate) {
    try {
      const result = validateInkFile(file);
      printResult(result);
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;
    } catch (error) {
      console.log(`\n❌ Ошибка при проверке ${file}:`);
      console.log(`   ${error instanceof Error ? error.message : error}`);
    }
  }
  
  // Общий итог
  console.log(`\n${"═".repeat(70)}`);
  console.log(`📋 ИТОГО:`);
  console.log(`   Файлов проверено: ${filesToValidate.length}`);
  console.log(`   Ошибок: ${totalErrors}`);
  console.log(`   Предупреждений: ${totalWarnings}`);
  console.log(`${"═".repeat(70)}\n`);
  
  if (totalErrors > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
