// ═══════════════════════════════════════════════════════════════════════════════
// ⚠️ DEPRECATED — НЕ ИСПОЛЬЗУЕТСЯ
// ═══════════════════════════════════════════════════════════════════════════════
// Этот файл устарел. Управление состоянием встроено в:
// → red-forest-complete.ink
//
// Единый файл обеспечивает:
// - Корректную передачу состояния между эпизодами
// - Единую систему LIST для улик
// - Safe tunnels для проверки sanity
// ═══════════════════════════════════════════════════════════════════════════════
// КРАСНЫЙ ЛЕС — Система управления состоянием (DEPRECATED)
// ═══════════════════════════════════════════════════════════════════════════════
// 
// ВАЖНО: Этот файл должен загружаться ПЕРВЫМ при старте любого эпизода.
// Переменные устанавливаются через внешние функции (inkjs API).
//
// АРХИТЕКТУРА:
// 1. При запуске эпизода N+1, InkStoryPlayer загружает состояние из эпизода N
// 2. Состояние передаётся через story.state или localStorage
// 3. Переменные НЕ объявляются заново — они наследуются
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// СПИСКИ (LIST) — Продвинутая система отслеживания
// ═══════════════════════════════════════════════════════════════════════════════

// Улики категории A — Исчезновения
LIST CluesA = (none_a), missing_list, false_reports, witness_conflict

// Улики категории B — Завод
LIST CluesB = (none_b), echo_docs, experiment_records, underground_map, access_pass

// Улики категории C — Культ
LIST CluesC = (none_c), cult_symbol, chernov_diary, ritual_photos, insider_testimony

// Улики категории D — История
LIST CluesD = (none_d), expedition_1890, serafim_legends, church_symbols

// Встречи с персонажами
LIST MetCharacters = (none_met), gromov, vera, serafim, tanya, astahov, chernov, klava, fyodor

// Ключевые события
LIST KeyEvents = (none_events), saw_symbol, heard_voices, found_notebook, found_photos, entered_caves, witnessed_ritual, confronted_cult

// Состояние отношений
LIST RelationshipState = (none_rel), romantic_tanya, betrayed_gromov, trusted_vera, helped_serafim

// Разблокированные концовки
LIST Endings = (none_endings), ending_truth, ending_hero, ending_sacrifice, ending_rebirth, ending_escape

// ═══════════════════════════════════════════════════════════════════════════════
// ОСНОВНЫЕ ПЕРЕМЕННЫЕ
// ═══════════════════════════════════════════════════════════════════════════════

// Рассудок: 100 = норма, 50 = галлюцинации, 25 = грань безумия
VAR sanity = 85

// Время
VAR days_remaining = 7
VAR current_day = 1
VAR current_date = "15 ноября 1986"

// Номер эпизода
VAR chapter = 1

// ═══════════════════════════════════════════════════════════════════════════════
// ДОВЕРИЕ ПЕРСОНАЖЕЙ (0-100)
// ═══════════════════════════════════════════════════════════════════════════════

VAR trust_gromov = 25      // Майор Громов — начальник милиции
VAR trust_vera = 15        // Вера Холодова — психиатр
VAR trust_serafim = 40     // Отец Серафим — священник
VAR trust_tanya = 35       // Таня Зорина — дочь пропавшего
VAR trust_astahov = 0      // Полковник Астахов — КГБ

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ ПОДСЧЁТА УЛИК
// ═══════════════════════════════════════════════════════════════════════════════

=== function count_clues_a() ===
~ return LIST_COUNT(CluesA) - 1  // -1 для none_a

=== function count_clues_b() ===
~ return LIST_COUNT(CluesB) - 1

=== function count_clues_c() ===
~ return LIST_COUNT(CluesC) - 1

=== function count_clues_d() ===
~ return LIST_COUNT(CluesD) - 1

=== function total_clues() ===
~ return count_clues_a() + count_clues_b() + count_clues_c() + count_clues_d()

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ ПРОВЕРКИ РАССУДКА
// ═══════════════════════════════════════════════════════════════════════════════

=== function is_sane() ===
~ return sanity >= 60

=== function is_disturbed() ===
~ return sanity >= 30 && sanity < 60

=== function is_mad() ===
~ return sanity < 30

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ ИЗМЕНЕНИЯ РАССУДКА (с ограничениями)
// ═══════════════════════════════════════════════════════════════════════════════

=== function lose_sanity(amount) ===
~ sanity = sanity - amount
{ sanity < 0:
    ~ sanity = 0
}
~ return sanity

=== function gain_sanity(amount) ===
~ sanity = sanity + amount
{ sanity > 100:
    ~ sanity = 100
}
~ return sanity

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ ПРОВЕРКИ КОНЦОВОК
// ═══════════════════════════════════════════════════════════════════════════════

=== function check_ending_truth() ===
// Правда наружу: >= 10 улик И sanity >= 40
~ return total_clues() >= 10 && sanity >= 40

=== function check_ending_hero() ===
// Тихий герой: cult_awareness high И sanity >= 40
~ return KeyEvents ? witnessed_ritual && sanity >= 40

=== function check_ending_sacrifice() ===
// Жертва: sanity < 30 ИЛИ добровольный выбор
~ return sanity < 30

=== function check_ending_rebirth() ===
// Перерождение: trust_vera >= 60 И принять предложение
~ return trust_vera >= 60 && RelationshipState ? trusted_vera

=== function check_ending_escape() ===
// Побег: trust_tanya >= 60
~ return trust_tanya >= 60

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ ДОБАВЛЕНИЯ УЛИК
// ═══════════════════════════════════════════════════════════════════════════════

=== function add_clue_a(clue) ===
{ not (CluesA ? clue):
    ~ CluesA += clue
}

=== function add_clue_b(clue) ===
{ not (CluesB ? clue):
    ~ CluesB += clue
}

=== function add_clue_c(clue) ===
{ not (CluesC ? clue):
    ~ CluesC += clue
}

=== function add_clue_d(clue) ===
{ not (CluesD ? clue):
    ~ CluesD += clue
}

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ ВСТРЕЧ
// ═══════════════════════════════════════════════════════════════════════════════

=== function meet_character(char) ===
{ not (MetCharacters ? char):
    ~ MetCharacters += char
}

=== function has_met(char) ===
~ return MetCharacters ? char

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ СОБЫТИЙ
// ═══════════════════════════════════════════════════════════════════════════════

=== function trigger_event(event) ===
{ not (KeyEvents ? event):
    ~ KeyEvents += event
}

=== function has_event(event) ===
~ return KeyEvents ? event

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИЯ ПЕРЕХОДА МЕЖДУ ЭПИЗОДАМИ
// ═══════════════════════════════════════════════════════════════════════════════

=== function advance_day() ===
~ days_remaining = days_remaining - 1
~ current_day = current_day + 1
{ current_day == 2:
    ~ current_date = "16 ноября 1986"
}
{ current_day == 3:
    ~ current_date = "17 ноября 1986"
}
{ current_day == 4:
    ~ current_date = "18 ноября 1986"
}
{ current_day == 5:
    ~ current_date = "19 ноября 1986"
}
~ return current_day

// ═══════════════════════════════════════════════════════════════════════════════
// ЭКСПОРТ/ИМПОРТ СОСТОЯНИЯ (для inkjs)
// ═══════════════════════════════════════════════════════════════════════════════
//
// В inkjs используйте:
//
// СОХРАНЕНИЕ:
// const state = story.state.toJson();
// localStorage.setItem('red_forest_state', state);
//
// ЗАГРУЗКА:
// const savedState = localStorage.getItem('red_forest_state');
// if (savedState) story.state.LoadJson(savedState);
//
// ═══════════════════════════════════════════════════════════════════════════════
