/**
 * ══════════════════════════════════════════════════════════════════════════════
 * INK COMPILER SCRIPT
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Компилирует .ink файлы в .json для использования с inkjs
 * 
 * Использование:
 *   npx tsx scripts/compile-ink.ts
 *   npx tsx scripts/compile-ink.ts content/investigations/lesopolosa.ink
 */

import * as fs from "fs";
import * as path from "path";

// inkjs/full включает компилятор
import { Compiler, CompilerOptions } from "inkjs/full";
import { IFileHandler } from "inkjs/compiler/FileHandler/IFileHandler";

const INVESTIGATIONS_DIR = path.join(process.cwd(), "content", "investigations");

/**
 * Анализирует синтаксис Ink файла перед компиляцией
 */
function analyzeSyntax(inkSource: string, inkPath: string): string[] {
  const errors: string[] = [];
  const lines = inkSource.split('\n');
  
  // Собираем все определённые knots и stitches
  const definedKnots = new Set<string>();
  const definedStitches = new Map<string, Set<string>>();
  let currentKnot = "";
  
  // Проверяем INCLUDE директивы и собираем knots из включаемых файлов
  const inkDir = path.dirname(inkPath);
  lines.forEach((line) => {
    const trimmed = line.trim();
    const includeMatch = trimmed.match(/^INCLUDE\s+(.+)$/);
    if (includeMatch) {
      const includePath = path.join(inkDir, includeMatch[1].trim());
      if (fs.existsSync(includePath)) {
        try {
          const includeSource = fs.readFileSync(includePath, "utf-8");
          const includeLines = includeSource.split('\n');
          includeLines.forEach((incLine) => {
            const incTrimmed = incLine.trim();
            const knotMatch = incTrimmed.match(/^===\s*(\w+)(?:\s*\([^)]*\))?\s*===?\s*$/);
            if (knotMatch) {
              definedKnots.add(knotMatch[1]);
            }
          });
        } catch { /* ignore */ }
      }
    }
  });
  
  // Первый проход: собираем определения из основного файла
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    
    // Knot: === name === или === name(params) ===
    const knotMatch = trimmed.match(/^===\s*(\w+)(?:\s*\([^)]*\))?\s*===?\s*$/);
    if (knotMatch) {
      currentKnot = knotMatch[1];
      definedKnots.add(currentKnot);
      definedStitches.set(currentKnot, new Set());
    }
    
    // Stitch: = name или = name(params)
    const stitchMatch = trimmed.match(/^=\s*(\w+)(?:\s*\([^)]*\))?\s*$/);
    if (stitchMatch && currentKnot) {
      definedStitches.get(currentKnot)?.add(stitchMatch[1]);
    }
  });
  
  // Добавляем встроенные
  definedKnots.add('END');
  definedKnots.add('DONE');
  
  currentKnot = "";
  let openBrackets = 0;
  let inMultiLineChoice = false;
  
  // Второй проход: ищем ошибки
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();
    
    // Пропускаем комментарии
    if (trimmed.startsWith('//')) return;
    
    // Обновляем текущий knot
    const knotMatchUpdate = trimmed.match(/^===\s*(\w+)(?:\s*\([^)]*\))?\s*===?\s*$/);
    if (knotMatchUpdate) {
      currentKnot = knotMatchUpdate[1];
    }
    
    // Проверяем незакрытые квадратные скобки в выборах
    if (trimmed.startsWith('*') || trimmed.startsWith('+')) {
      const bracketOpen = (trimmed.match(/\[/g) || []).length;
      const bracketClose = (trimmed.match(/\]/g) || []).length;
      if (bracketOpen > bracketClose) {
        errors.push(`Строка ${lineNum}: Незакрытая скобка '[' в выборе`);
      } else if (bracketClose > bracketOpen) {
        errors.push(`Строка ${lineNum}: Лишняя закрывающая скобка ']'`);
      }
    }
    
    // Проверяем переходы (diverts)
    // Паттерн: -> knot или -> knot.stitch или -> knot(args) или -> (для tunnel return)
    const divertMatches = trimmed.matchAll(/->\s*(\w+)(?:\s*\([^)]*\))?(?:\.(\w+))?/g);
    for (const match of divertMatches) {
      const targetKnot = match[1];
      const targetStitch = match[2];
      
      // Пропускаем tunnel return (->->)
      if (targetKnot === '>') continue;
      
      if (!definedKnots.has(targetKnot)) {
        errors.push(`Строка ${lineNum}: Переход к несуществующему knot '${targetKnot}'`);
      } else if (targetStitch) {
        const stitches = definedStitches.get(targetKnot);
        if (stitches && !stitches.has(targetStitch)) {
          errors.push(`Строка ${lineNum}: Переход к несуществующему stitch '${targetKnot}.${targetStitch}'`);
        }
      }
    }
    
    // Проверяем незакрытые фигурные скобки (условия и inline логика)
    const curlyOpen = (trimmed.match(/\{/g) || []).length;
    const curlyClose = (trimmed.match(/\}/g) || []).length;
    openBrackets += curlyOpen - curlyClose;
    
    // Проверяем синтаксис переменных
    if (trimmed.startsWith('~')) {
      // Должно быть присваивание, вызов функции или return
      const validPatterns = ['=', '(', '++', '--', 'return', 'temp '];
      const isValid = validPatterns.some(p => trimmed.includes(p));
      if (!isValid) {
        errors.push(`Строка ${lineNum}: Некорректный синтаксис переменной: ${trimmed}`);
      }
    }
    
    // Проверяем VAR объявления
    if (trimmed.startsWith('VAR ')) {
      if (!trimmed.includes('=')) {
        errors.push(`Строка ${lineNum}: VAR должна иметь начальное значение: ${trimmed}`);
      }
    }
    
    // Проверяем пустые выборы
    if ((trimmed === '*' || trimmed === '+') && !lines[i + 1]?.trim()) {
      errors.push(`Строка ${lineNum}: Пустой выбор без текста`);
    }
    
    // Проверяем двойные тире (частая опечатка вместо ->)
    if (trimmed.includes('--') && !trimmed.startsWith('//') && !trimmed.includes('--=')) {
      if (!trimmed.includes('++') && !trimmed.startsWith('~')) {
        // Может быть опечатка -- вместо ->
        if (trimmed.match(/--\s*\w+/)) {
          errors.push(`Строка ${lineNum}: Возможно опечатка '--' вместо '->'?`);
        }
      }
    }
  });
  
  // Проверяем незакрытые фигурные скобки в конце
  if (openBrackets !== 0) {
    errors.push(`Незакрытые фигурные скобки: ${openBrackets > 0 ? 'не хватает }' : 'лишние }'}`);
  }
  
  return errors;
}

async function compileInkFile(inkPath: string): Promise<void> {
  console.log(`\n📖 Компиляция: ${inkPath}`);

  // Читаем .ink файл
  const inkSource = fs.readFileSync(inkPath, "utf-8");

  // Собираем ошибки
  const errors: string[] = [];
  const warnings: string[] = [];

  // Сначала проведём собственный анализ синтаксиса
  const syntaxErrors = analyzeSyntax(inkSource, inkPath);
  if (syntaxErrors.length > 0) {
    console.log("\n❌ Синтаксические ошибки:");
    syntaxErrors.forEach((e) => console.log(`   ${e}`));
    return;
  }

  try {
    // Создаём FileHandler для обработки INCLUDE директив
    const inkDir = path.dirname(inkPath);
    const fileHandler: IFileHandler = {
      ResolveInkFilename: (filename: string): string => {
        return path.join(inkDir, filename);
      },
      LoadInkFileContents: (filename: string): string => {
        const fullPath = path.isAbsolute(filename) ? filename : path.join(inkDir, filename);
        return fs.readFileSync(fullPath, "utf-8");
      }
    };

    // Компилируем с обработкой ошибок и FileHandler
    const compilerOptions: CompilerOptions = {
      sourceFilename: inkPath,
      errorHandler: (message: string, errorType: number) => {
        // errorType: 0 = Author, 1 = Warning, 2 = Error
        if (errorType === 2) {
          errors.push(message);
        } else if (errorType === 1) {
          warnings.push(message);
        } else {
          warnings.push(`[Author] ${message}`);
        }
      },
      fileHandler: fileHandler
    };
    
    const compiler = new Compiler(inkSource, compilerOptions);
    
    let story;
    try {
      story = compiler.Compile();
    } catch (compileError) {
      // Показываем ВСЕ собранные ошибки
      if (errors.length > 0) {
        console.log("\n❌ Ошибки компиляции Ink:");
        errors.forEach((e) => console.log(`   ${e}`));
      }
      if (warnings.length > 0) {
        console.log("\n⚠️ Предупреждения:");
        warnings.forEach((w) => console.log(`   ${w}`));
      }
      if (errors.length === 0 && compileError instanceof Error) {
        console.log(`\n❌ Ошибка компилятора: ${compileError.message}`);
        // Попробуем извлечь номер строки
        const match = compileError.message.match(/line (\d+)/i);
        if (match) {
          const lineNum = parseInt(match[1]);
          const lines = inkSource.split('\n');
          console.log(`\n📍 Контекст ошибки:`);
          for (let i = Math.max(0, lineNum - 3); i < Math.min(lines.length, lineNum + 2); i++) {
            const marker = i === lineNum - 1 ? '>>>' : '   ';
            console.log(`   ${marker} ${i + 1}: ${lines[i]}`);
          }
        }
        // Также попробуем показать стек ошибки
        if (compileError.stack) {
          console.log(`\n📋 Stack trace:`);
          console.log(compileError.stack.split('\n').slice(0, 5).join('\n'));
        }
      }
      return;
    }
    
    // Показываем ошибки
    if (errors.length > 0) {
      console.log("\n❌ Ошибки компиляции:");
      errors.forEach((e) => console.log(`   ${e}`));
      return;
    }
    
    if (!story) {
      console.log("\n❌ Компиляция вернула null (неизвестная ошибка)");
      // Попробуем найти синтаксические ошибки вручную
      console.log("\n🔍 Анализ синтаксиса...");
      const lines = inkSource.split('\n');
      let inChoice = false;
      let lastKnot = "";
      
      lines.forEach((line, i) => {
        const lineNum = i + 1;
        const trimmed = line.trim();
        
        // Проверяем незакрытые скобки
        if (trimmed.startsWith('*') && trimmed.includes('[') && !trimmed.includes(']')) {
          console.log(`   Строка ${lineNum}: Незакрытая скобка в выборе`);
        }
        
        // Проверяем knot
        if (trimmed.startsWith('===')) {
          const match = trimmed.match(/^===\s*(\w+)/);
          if (match) lastKnot = match[1];
        }
        
        // Проверяем переходы к несуществующим knots
        const divertMatch = trimmed.match(/->\s*(\w+)/);
        if (divertMatch) {
          const target = divertMatch[1];
          const knotExists = inkSource.includes(`=== ${target} ===`) || 
                            inkSource.includes(`= ${target}`) ||
                            target === 'END' || target === 'DONE';
          if (!knotExists) {
            console.log(`   Строка ${lineNum}: Переход к несуществующему knot '${target}'`);
          }
        }
        
        // Проверяем некорректные переменные
        if (trimmed.startsWith('~') && !trimmed.includes('=') && !trimmed.includes('(')) {
          console.log(`   Строка ${lineNum}: Некорректное выражение переменной`);
        }
      });
      
      return;
    }
    
    // Получаем JSON
    const storyJson = story.ToJson();
    
    if (!storyJson) {
      console.log("\n❌ Не удалось получить JSON из скомпилированной истории");
      return;
    }

    // Путь для JSON
    const jsonPath = inkPath.replace(".ink", ".ink.json");

    // Записываем
    fs.writeFileSync(jsonPath, storyJson as string, "utf-8");

    console.log(`✅ Скомпилировано: ${jsonPath}`);
    console.log(`   Размер: ${(Buffer.byteLength(storyJson as string) / 1024).toFixed(1)} KB`);

    // Показываем warnings
    if (warnings.length > 0) {
      console.log("\n⚠️ Предупреждения:");
      warnings.forEach((w) => console.log(`   ${w}`));
    }
  } catch (error) {
    // Показываем собранные ошибки
    if (errors.length > 0) {
      console.log("\n❌ Ошибки компиляции:");
      errors.forEach((e) => console.log(`   ${e}`));
    } else {
      console.error(`\n❌ Неизвестная ошибка:`);
      if (error instanceof Error) {
        console.error(`   ${error.message}`);
      } else {
        console.error(`   ${error}`);
      }
    }
  }
}

async function compileAll(): Promise<void> {
  console.log("════════════════════════════════════════════════════════════════");
  console.log("                    INK COMPILER                                  ");
  console.log("════════════════════════════════════════════════════════════════");

  // Если указан конкретный файл
  const targetFile = process.argv[2];
  if (targetFile) {
    const fullPath = path.isAbsolute(targetFile)
      ? targetFile
      : path.join(process.cwd(), targetFile);
    await compileInkFile(fullPath);
    return;
  }

  // Иначе компилируем все .ink файлы
  if (!fs.existsSync(INVESTIGATIONS_DIR)) {
    console.log("📁 Создаём директорию investigations...");
    fs.mkdirSync(INVESTIGATIONS_DIR, { recursive: true });
  }

  const files = fs.readdirSync(INVESTIGATIONS_DIR);
  const inkFiles = files.filter((f) => f.endsWith(".ink"));

  if (inkFiles.length === 0) {
    console.log("⚠️ Не найдено .ink файлов в content/investigations/");
    return;
  }

  console.log(`\n📚 Найдено ${inkFiles.length} .ink файлов\n`);

  for (const file of inkFiles) {
    const fullPath = path.join(INVESTIGATIONS_DIR, file);
    await compileInkFile(fullPath);
  }

  console.log("\n════════════════════════════════════════════════════════════════");
  console.log("                    ✅ ГОТОВО                                      ");
  console.log("════════════════════════════════════════════════════════════════\n");
}

compileAll().catch(console.error);
