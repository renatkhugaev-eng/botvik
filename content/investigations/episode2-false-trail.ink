// ══════════════════════════════════════════════════════════════════════════════
// ЭПИЗОД 2: ЛОЖНЫЙ СЛЕД
// Дело Кравченко — судебная ошибка 1979 года
// Полностью нелинейное расследование
// ══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ═══════════════════════════════════════════════════════════════════════════════

// Основные метрики
VAR objectivity = 50
VAR score = 0
VAR chapter = 1
VAR days_remaining = 3

// Отношения
VAR kravchenko_trust = 0
VAR prosecutor_favor = 50
VAR team_morale = 50

// Состояние дела
VAR evidence_against_kravchenko = 1  // Начинаем с судимости
VAR evidence_for_kravchenko = 0
VAR confession_obtained = false
VAR confession_forced = false

// Флаги расследования
VAR alibi_checked = false
VAR alibi_confirmed = false
VAR blood_tested = false
VAR blood_mismatch = false
VAR timeline_analyzed = false
VAR pattern_discovered = false
VAR grey_coat_found = false
VAR chikatilo_suspected = false
VAR case_files_reviewed = false
VAR coins_verified = false

// Флаги улик (для доски улик)
VAR clue_prior_conviction = false
VAR clue_neighbor_alibi = false
VAR clue_timeline_gap = false
VAR clue_blood_mismatch = false
VAR clue_grey_coat = false
VAR clue_serial_pattern = false
VAR clue_forced_confession = false
VAR clue_coins_alibi = false
VAR clue_bite_marks = false
VAR clue_suspicious_records = false

// Состояние допроса
VAR interrogation_count = 0
VAR used_pressure = false
VAR used_empathy = false

// Начальный переход (ВАЖНО: должен быть ДО функций!)
-> prologue

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ
// ═══════════════════════════════════════════════════════════════════════════════

=== function add_score(points) ===
~ score = score + points

=== function clamp_objectivity() ===
{
    - objectivity > 100:
        ~ objectivity = 100
    - objectivity < 0:
        ~ objectivity = 0
}

=== function change_objectivity(delta) ===
~ objectivity = objectivity + delta
~ clamp_objectivity()

=== function clamp_prosecutor() ===
{
    - prosecutor_favor > 100:
        ~ prosecutor_favor = 100
    - prosecutor_favor < 0:
        ~ prosecutor_favor = 0
}

=== function change_prosecutor(delta) ===
~ prosecutor_favor = prosecutor_favor + delta
~ clamp_prosecutor()

=== function pass_day() ===
~ days_remaining = days_remaining - 1

=== function has_strong_evidence() ===
~ return evidence_for_kravchenko >= 3

// ═══════════════════════════════════════════════════════════════════════════════
// НАЧАЛО
// ═══════════════════════════════════════════════════════════════════════════════

=== prologue ===
# chapter: 1
# mood: professional
# title: Под подозрением

═══════════════════════════════
     ЭПИЗОД 2: ЛОЖНЫЙ СЛЕД
═══════════════════════════════

ЯНВАРЬ 1979 ГОДА
г. Шахты, Ростовская область

-> prologue_intro

=== prologue_intro ===
# mood: atmospheric
# speaker: narrator

Холодное январское утро. За окном — серое небо и хрустящий снег.

Месяц прошёл с момента обнаружения тела Лены Закотновой в лесополосе у Грушевского моста.

Дело на контроле в Москве. Партийное руководство требует результатов.

Давление нарастает с каждым днём.

# speaker: operator

<i>— Товарищ следователь, вас вызывают к прокурору. Срочно.</i>

-> prosecutor_summons

=== prosecutor_summons ===
# speaker: narrator

Кабинет прокурора города. Массивный стол, портрет Брежнева на стене, запах папиросного дыма.

# speaker: prosecutor_fokin

— Садитесь. У нас подозреваемый.

Он кладёт на стол тонкую папку.

— Александр Кравченко. Судимость по 117-й. Живёт рядом с местом преступления. Соседи видели его в тот день.

# speaker: narrator

Прокурор смотрит вам в глаза.

# speaker: prosecutor_fokin

— У вас три дня. Москва ждёт закрытия дела к годовщине.

* [Три дня — мало для объективного расследования...]
    # speaker: narrator
    Вы сдерживаете возражение. Спорить с системой — опасно.
    ~ change_objectivity(5)
    -> receive_case_file

* [Понял. Приступаю немедленно.]
    # speaker: narrator
    Прокурор удовлетворённо кивает.
    ~ change_prosecutor(5)
    -> receive_case_file

* [А если он невиновен?]
    # speaker: prosecutor_fokin
    — Невиновен? С такой биографией?
    
    # speaker: narrator
    Холодный смех.
    
    # speaker: prosecutor_fokin
    — Ваша задача — доказать вину. Факты уже есть.
    ~ change_objectivity(10)
    ~ change_prosecutor(-5)
    -> receive_case_file

=== receive_case_file ===
# speaker: narrator

Вы берёте папку. Тонкая, но тяжёлая — от неё зависит чья-то судьба.

# speaker: operator

<i>— Подозреваемый в допросной. Ждёт уже два часа.</i>

* [Открыть досье Кравченко]
    -> suspect_dossier

=== suspect_dossier ===
# mood: investigation

ДОСЬЕ ПОДОЗРЕВАЕМОГО:

Александр Петрович Кравченко, 26 лет.

Судимость: статья 117 УК РСФСР (изнасилование несовершеннолетней), 1970 год. Освобождён условно-досрочно в 1977.

~ clue_prior_conviction = true
# clue: prior_conviction

Проживает в 500 метрах от места обнаружения тела.

Задержан по показаниям соседей — якобы видели его 22 декабря.

* [Судимость — серьёзная улика]
    ~ change_objectivity(-10)
    ~ evidence_against_kravchenko += 1
    Рецидивисты редко меняются...
    -> first_assessment
    
* [Нужно проверить факты объективно]
    ~ change_objectivity(5)
    ~ add_score(10)
    Судимость — не доказательство.
    -> first_assessment
    
* [Слишком удобный подозреваемый]
    ~ change_objectivity(10)
    ~ add_score(15)
    Быстрое закрытие выгодно всем... кроме правосудия.
    -> first_assessment

=== first_assessment ===
# speaker: operator

Дежурный заглядывает в кабинет:

— Товарищ следователь, подозреваемый доставлен. Прокурор Коржов ждёт результатов.

+ [Начать допрос] -> interrogation_hub

// ═══════════════════════════════════════════════════════════════════════════════
// ЦЕНТР ДОПРОСА — главный хаб
// ═══════════════════════════════════════════════════════════════════════════════

=== interrogation_hub ===
# chapter: 2
# mood: pressure
# title: Допросная

~ interrogation_count += 1

{interrogation_count == 1:
    Комната для допросов. Тусклая лампа. Металлический стол.
    
    За столом — молодой мужчина. Испуганные глаза. Трясущиеся руки.
}

{interrogation_count > 1:
    Вы снова в допросной. Кравченко поднимает голову.
}

# speaker: kravchenko
{interrogation_count == 1:
    — Я ничего не делал! Богом клянусь... В тот день был дома. Спросите соседей!
}
{interrogation_count > 1 && not confession_obtained:
    — Опять вы... Я уже всё рассказал. Сколько можно?
}
{confession_obtained && not confession_forced:
    — Я... я признался. Что ещё нужно?
}
{confession_forced:
    Кравченко молчит. Смотрит в пол. На лице — следы побоев.
}

// Выборы зависят от состояния
* {not used_pressure && not confession_obtained} [Жёстко: "Признавайся!"]
    ~ used_pressure = true
    -> pressure_tactics
    
* {not used_empathy && not confession_obtained} [Спокойно: "Расскажите о 22 декабря"]
    ~ used_empathy = true
    -> empathy_approach
    
* {not alibi_checked} [Проверить алиби до допроса]
    ~ change_objectivity(10)
    ~ add_score(15)
    -> check_alibi_tunnel ->
    -> interrogation_hub

* {alibi_checked && not confession_obtained} [Предъявить результаты проверки алиби]
    -> confront_with_alibi
    
* {blood_mismatch && not confession_obtained} [Предъявить результаты экспертизы крови]
    -> confront_with_blood

* {pattern_discovered && not confession_obtained} [Спросить о других убийствах]
    -> ask_about_pattern

+ {interrogation_count >= 2} [Выйти из допросной]
    -> investigation_hub

// ═══════════════════════════════════════════════════════════════════════════════
// ТАКТИКИ ДОПРОСА
// ═══════════════════════════════════════════════════════════════════════════════

=== pressure_tactics ===
# mood: conflict

Вы повышаете голос:

— Мы знаем, что это ты! У тебя судимость. Жил рядом. Признавайся!

# speaker: kravchenko
Кравченко бледнеет, вжимается в стул.

— Н-нет... Я не... Пожалуйста, не бейте...

~ kravchenko_trust -= 2
~ change_objectivity(-5)

В дверь стучат. Входит прокурор Коржов — грузный мужчина в дорогом костюме.

# speaker: prosecutor
— Ну что, Фетисов? Признался?

* [Пока нет. Нужно время]
    ~ change_prosecutor(-5)
    # speaker: prosecutor
    — Время — роскошь. Москва ждёт.
    -> interrogation_hub
    
* [Работаем. Скоро будет результат]
    # speaker: prosecutor
    — Хорошо. Жду до вечера.
    -> interrogation_hub
    
* [Может, стоит применить... методы?]
    ~ change_objectivity(-20)
    ~ change_prosecutor(10)
    -> forced_confession_path

=== empathy_approach ===
# mood: investigation

Вы садитесь напротив, говорите спокойно:

— Александр, расскажите, что вы делали 22 декабря. Не торопитесь.

# speaker: kravchenko
Кравченко немного расслабляется. Говорит сбивчиво, но связно:

— 22 декабря... Был дома до обеда. Потом пошёл в магазин за хлебом. Соседка Мария Петровна видела — поздоровались даже. Вернулся, смотрел телевизор. "Кабачок 13 стульев" показывали...

~ kravchenko_trust += 1
~ change_objectivity(5)

# speaker: fetisov
— Во сколько выходили?

# speaker: kravchenko
— Около трёх. Вернулся минут через сорок. Жена была на работе до шести.

* [Записать и проверить показания]
    ~ add_score(10)
    -> check_alibi_tunnel ->
    Показания записаны. Оперативник отправлен проверять.
    -> interrogation_hub
    
* [А вечером? После шести?]
    -> evening_alibi
    
* [Продолжить допрос]
    -> interrogation_hub

=== evening_alibi ===
# speaker: kravchenko

— Вечером? Жена пришла с работы. Ужинали. Потом легли спать. Обычный день.

— Соседи могут подтвердить. Стены тонкие — всё слышно.

~ kravchenko_trust += 1

+ [Достаточно. Проверим] 
    -> check_alibi_tunnel ->
    -> interrogation_hub

// ═══════════════════════════════════════════════════════════════════════════════
// ТУННЕЛЬ ПРОВЕРКИ АЛИБИ
// ═══════════════════════════════════════════════════════════════════════════════

=== check_alibi_tunnel ===
# mood: investigation

{alibi_checked:
    Алиби уже проверено.
    ->->
}

~ alibi_checked = true

Вы отправляете оперативника к соседям.

Через два часа он возвращается с протоколом опроса.

# speaker: operator
— Соседка Мария Петровна Козлова подтверждает: видела Кравченко около 15:00-15:30, шёл в сторону магазина. Видела его возвращающимся примерно в 15:45.

~ clue_neighbor_alibi = true
# clue: neighbor_alibi

~ evidence_for_kravchenko += 1
~ add_score(15)

# speaker: fetisov
— Время смерти?

# speaker: operator
— По данным экспертизы — между 14:00 и 15:30.

Вот в чём проблема.

* [Какая проблема?]
    -> timeline_analysis

=== timeline_analysis ===
# mood: mystery

~ timeline_analyzed = true

# speaker: operator
— Расстояние от дома Кравченко до места обнаружения тела — более 2 километров через лесополосу. По снегу.

— Туда и обратно — минимум час. А его видели в 15:00 у магазина.

— И ещё: на нём была обычная домашняя одежда. Ни пятен, ни грязи.

~ clue_timeline_gap = true
# clue: timeline_inconsistency

~ evidence_for_kravchenko += 1
~ add_score(20)

Временное окно не сходится.

* [Задокументировать нестыковку]
    ~ change_objectivity(10)
    Вы записываете всё в протокол.
    ->->
    
* [Мог переодеться...]
    ~ change_objectivity(-5)
    Слабый аргумент, но возможный.
    ->->

// ═══════════════════════════════════════════════════════════════════════════════
// ПРЕДЪЯВЛЕНИЕ УЛИК
// ═══════════════════════════════════════════════════════════════════════════════

=== confront_with_alibi ===
# mood: investigation

— Александр, соседи подтвердили — вы были у магазина в 15:00. 

{alibi_confirmed:
    — И продавщица подтвердила время покупки.
}

# speaker: kravchenko
— Да! Да! Я же говорил! Я не мог... физически не мог!

~ kravchenko_trust += 2

{timeline_analyzed:
    — Два километра по снегу за полчаса, совершить убийство и вернуться как ни в чём не бывало? Это невозможно!
}

+ [Вернуться к расследованию]
    -> investigation_hub

=== confront_with_blood ===
# mood: discovery

— Александр, у меня результаты экспертизы крови.

# speaker: kravchenko
— Какой экспертизы?

# speaker: fetisov
— Ваша группа крови — AB, четвёртая. Биологические следы на месте преступления — группа A, вторая.

Кравченко смотрит непонимающе.

# speaker: fetisov
— Это значит, что вы физически НЕ МОГЛИ оставить те следы.

# speaker: kravchenko
— Я же говорил... Это не я... — голос срывается. — Спасибо... Спасибо, что проверили...

~ kravchenko_trust += 3
~ add_score(25)

+ [Продолжить расследование]
    -> investigation_hub

=== ask_about_pattern ===
# mood: mystery

— Александр, где вы были в 1971 году? В 1973? В 1975?

# speaker: kravchenko
— В... в тюрьме. Я же сидел с 1970 по 1977...

# speaker: fetisov
— Именно. А в эти годы произошли похожие убийства. С тем же почерком.

Кравченко бледнеет, но уже от облегчения:

# speaker: kravchenko
— То есть... вы мне верите?

~ kravchenko_trust += 3
~ add_score(30)

+ [Да. Но мне нужно убедить прокурора]
    -> investigation_hub

// ═══════════════════════════════════════════════════════════════════════════════
// ПРИНУДИТЕЛЬНОЕ ПРИЗНАНИЕ
// ═══════════════════════════════════════════════════════════════════════════════

=== forced_confession_path ===
# mood: horror
# chapter: 3
# title: Тёмная сторона

Прокурор Коржов понимающе кивает:

# speaker: prosecutor
— Делай что нужно. Методы — на твоё усмотрение. Главное — результат.

Он выходит.

Следующие часы — худшие в вашей карьере.

* [Присутствовать, но не участвовать]
    ~ change_objectivity(-15)
    Вы стоите в углу, пока оперативники "работают".
    -> confession_obtained_forced
    
* [Остановить это!]
    ~ change_objectivity(20)
    ~ change_prosecutor(-30)
    ~ add_score(30)
    -> stop_torture

=== stop_torture ===
# mood: conflict

— Хватит! — вы отталкиваете оперативника. — Это незаконно!

# speaker: operator
— Товарищ следователь, прокурор приказал...

# speaker: fetisov
— Я отвечаю за это дело. И я приказываю прекратить.

Оперативники переглядываются, но отступают.

Кравченко скорчился в углу. Лицо в крови.

~ clue_forced_confession = true
# clue: forced_methods

* [Вызвать врача] 
    ~ kravchenko_trust += 3
    ~ team_morale -= 10
    {prosecutor_favor < 20:
        Прокурор Коржов появляется в дверях. Его лицо багровеет.
        
        # speaker: prosecutor
        — Ты посмел остановить допрос?! Пиши рапорт. Ты отстранён!
        
        -> conscience_ending
    }
    -> investigation_hub

=== confession_obtained_forced ===
# mood: dark

К утру Кравченко подписывает признание.

~ confession_obtained = true
~ confession_forced = true
~ clue_forced_confession = true
# clue: forced_methods

# speaker: kravchenko
— Да... Я сделал это... Напишите что хотите... только не бейте больше...

# speaker: prosecutor
— Отличная работа, Фетисов.

Но вы видите его глаза. И знаете правду.

* [Правду, которую вы похоронили]
    ~ change_objectivity(-30)
    -> bad_ending_fast

// ═══════════════════════════════════════════════════════════════════════════════
// ЦЕНТР РАССЛЕДОВАНИЯ — главный хаб
// ═══════════════════════════════════════════════════════════════════════════════

=== investigation_hub ===
# chapter: 3
# mood: investigation
# title: Расследование

{days_remaining > 0:
    Осталось дней: {days_remaining}
- else:
    Время вышло.
    -> time_expired
}

Вы в своём кабинете. Материалы дела на столе.

{has_strong_evidence():
    У вас достаточно доказательств невиновности Кравченко.
}

Что делать?

* {not blood_tested} [Заказать экспертизу крови]
    ~ pass_day()
    -> blood_test_tunnel ->
    -> investigation_hub

* {not case_files_reviewed} [Изучить материалы дела детально]
    -> review_case_files ->
    -> investigation_hub

* {not pattern_discovered} [Проверить похожие нераскрытые дела]
    ~ pass_day()
    -> pattern_search_tunnel ->
    -> investigation_hub

* {alibi_checked && not coins_verified} [Проверить алиби через магазин]
    -> verify_coins_tunnel ->
    -> investigation_hub

* {not grey_coat_found} [Искать других подозреваемых]
    ~ pass_day()
    -> search_suspects_tunnel ->
    -> investigation_hub

* [Допросить Кравченко снова]
    -> interrogation_hub

* {has_strong_evidence()} [Доложить прокурору о невиновности]
    -> confront_prosecutor_evidence

* {prosecutor_favor < 30} [Прокурор требует результатов...]
    -> prosecutor_pressure

+ [Подвести итоги]
    -> summary_hub

// ═══════════════════════════════════════════════════════════════════════════════
// ЭКСПЕРТИЗА КРОВИ
// ═══════════════════════════════════════════════════════════════════════════════

=== blood_test_tunnel ===
# mood: investigation
# document: blood_analysis

{blood_tested:
    Экспертиза уже проведена.
    ->->
}

~ blood_tested = true

Вы отправляете образцы на экспертизу в областное бюро.

На следующий день — результат.

# speaker: expert
— Товарищ следователь, есть важное наблюдение.

— Группа крови подозреваемого Кравченко — AB, четвёртая.
— Биологические следы на месте преступления — группа A, вторая.

# speaker: fetisov
— То есть...

# speaker: expert
— Кравченко НЕ МОГ оставить эти следы. Группы не совпадают.

~ blood_mismatch = true
~ clue_blood_mismatch = true
# clue: blood_mismatch_ep2

~ evidence_for_kravchenko += 2
~ add_score(30)

Это серьёзная улика.

* [Зафиксировать в протоколе]
    ~ change_objectivity(10)
    ->->

// ═══════════════════════════════════════════════════════════════════════════════
// ИЗУЧЕНИЕ МАТЕРИАЛОВ ДЕЛА
// ═══════════════════════════════════════════════════════════════════════════════

=== review_case_files ===
# mood: investigation
# document: case_files

{case_files_reviewed:
    Материалы уже изучены.
    ->->
}

~ case_files_reviewed = true

Вы перечитываете все документы. Отчёт о вскрытии. Показания свидетелей. Протоколы осмотра.

И замечаете деталь:

# speaker: fetisov
— "На теле жертвы обнаружены характерные следы укусов..."

Укусы. Специфическая деталь.

{confession_obtained:
    В признании Кравченко об укусах — ни слова.
    
    ~ clue_bite_marks = true
    # clue: missing_detail
    
    ~ evidence_for_kravchenko += 2
    ~ add_score(25)
    
    Если бы он был убийцей — он бы знал об укусах.
}

{not confession_obtained:
    Нужно проверить — знает ли Кравченко об этой детали.
    
    ~ clue_bite_marks = true
    # clue: missing_detail
    
    ~ add_score(15)
}

* [Продолжить изучение]
    ->->

// ═══════════════════════════════════════════════════════════════════════════════
// ПОИСК СЕРИЙНОЙ ЗАКОНОМЕРНОСТИ
// ═══════════════════════════════════════════════════════════════════════════════

=== pattern_search_tunnel ===
# mood: mystery

{pattern_discovered:
    Закономерность уже обнаружена.
    ->->
}

Вы поднимаете архивы нераскрытых дел за последние годы.

И находите нечто тревожное.

═══════════════════════════════════════
НЕРАСКРЫТЫЕ ДЕЛА (ПОХОЖИЙ ПОЧЕРК)

1971 — исчезновение девочки, Новошахтинск
1973 — убийство подростка, пос. Донской
1975 — неопознанное тело, лесополоса
1977 — убийство мальчика, г. Шахты

ВО ВСЕХ СЛУЧАЯХ:
• Жертвы — дети 8-15 лет
• Множественные ножевые ранения
• Тела в лесополосах
• Убийца не установлен
═══════════════════════════════════════

~ pattern_discovered = true
~ clue_serial_pattern = true
# clue: serial_pattern

~ evidence_for_kravchenko += 3
~ add_score(40)

Это СЕРИЯ.

И Кравченко сидел в тюрьме с 1970 по 1977. Он НЕ МОГ совершить те убийства.

* [Это ключевая улика!]
    ~ change_objectivity(15)
    ->->

// ═══════════════════════════════════════════════════════════════════════════════
// ПРОВЕРКА АЛИБИ ЧЕРЕЗ МОНЕТЫ
// ═══════════════════════════════════════════════════════════════════════════════

=== verify_coins_tunnel ===
# mood: discovery

{coins_verified:
    Монеты уже проверены.
    ->->
}

{not alibi_checked:
    Сначала нужно узнать детали алиби от Кравченко.
    ->->
}

Вы ищете продавщицу из магазина. Галина Степановна.

# speaker: witness
— Тот парень 22 декабря? Помню! Платил юбилейными рублями к Олимпиаде. Я ещё ворчала — где он их столько набрал?

# speaker: fetisov
— Во сколько это было?

# speaker: witness
— Около трёх. Точно помню — у меня пересменка начиналась, на часы смотрела. Может, четверть четвёртого.

~ coins_verified = true
~ alibi_confirmed = true
~ clue_coins_alibi = true
# clue: coin_alibi

~ evidence_for_kravchenko += 2
~ add_score(30)

15:00-15:15. Время смерти — около 14:30.

Кравченко не мог убить девочку и через полчаса спокойно покупать водку.

* [Алиби подтверждено!]
    ->->

// ═══════════════════════════════════════════════════════════════════════════════
// ПОИСК ДРУГИХ ПОДОЗРЕВАЕМЫХ
// ═══════════════════════════════════════════════════════════════════════════════

=== search_suspects_tunnel ===
# mood: mystery

Вы изучаете показания — кто ещё был в районе 22 декабря?

Участковый приносит список:

═══════════════════════════════════════
ЛИЦА В РАЙОНЕ 22.12.1978

1. Кравченко А.П. — задержан
2. Неизвестный в сером пальто
   (показания свидетельницы Петровой)
3. Работник "Ростсельмаша" 
   (проверял оборудование на ферме)
4. Двое подростков — алиби подтверждено
═══════════════════════════════════════

* [Искать человека в сером пальто]
    -> search_grey_coat
    
* [Проверить работника "Ростсельмаша"]
    -> check_rostelmash_worker

=== search_grey_coat ===
# mood: investigation

Вы организуете поиск. Опрашиваете жителей, проверяете билеты на поезда.

Через два дня — ничего.

# speaker: operator
— Никто больше его не видел. Как призрак.

Но одна деталь:

# speaker: witness
— Он шёл странно. Торопился, но не бежал. И у него была сумка. Или свёрток.

~ grey_coat_found = true
~ clue_grey_coat = true
# clue: grey_coat_man

~ add_score(15)

Человек в сером пальто. Со свёртком. Уходит от места преступления.

А вы держите в камере другого.

* [Доложить прокурору]
    ~ change_prosecutor(-10)
    -> investigation_hub
    
* [Продолжить искать молча]
    ~ change_objectivity(5)
    -> investigation_hub

=== check_rostelmash_worker ===
# mood: investigation

Работник "Ростсельмаша" — Андрей Романович Чикатило, 42 года. Снабженец.

Проверка: был на ферме с 13:00 до 17:00. Записи в журнале.

# speaker: operator
— Алиби железное. Его видели несколько человек.

~ add_score(5)

* [Вычеркнуть из списка]
    -> investigation_hub
    
* [Что-то не так... проверить журнал]
    ~ change_objectivity(10)
    -> check_farm_records

=== check_farm_records ===
# mood: mystery

Вы изучаете журнал фермы.

# speaker: fetisov
— Почерк одинаковый. Все записи за неделю — одна рука.

# speaker: operator
— Может, завхоз записывал?

# speaker: fetisov
— Или кто-то подделал...

~ chikatilo_suspected = true
~ clue_suspicious_records = true
# clue: suspicious_records

~ add_score(20)

Но прямых доказательств нет. И времени нет.

* [Записать и отложить на потом]
    -> investigation_hub

// ═══════════════════════════════════════════════════════════════════════════════
// ПРОТИВОСТОЯНИЕ С ПРОКУРОРОМ
// ═══════════════════════════════════════════════════════════════════════════════

=== prosecutor_pressure ===
# mood: pressure

Прокурор Коржов входит без стука.

# speaker: prosecutor
— Фетисов. Где результат?

{prosecutor_favor < 20:
    Его лицо красное от гнева.
    — Москва звонит каждый день! Ты понимаешь, что ставишь под удар?
}

* [Изложить сомнения]
    -> confront_prosecutor_doubts
    
* [Попросить ещё время]
    ~ change_prosecutor(-10)
    # speaker: prosecutor
    — День. У тебя день.
    ~ days_remaining = 1
    -> investigation_hub
    
* [Дожать Кравченко...]
    ~ change_objectivity(-15)
    ~ change_prosecutor(10)
    -> forced_confession_path

=== confront_prosecutor_doubts ===
# mood: conflict

Вы излагаете:
{timeline_analyzed: — Временные нестыковки.}
{blood_mismatch: — Группа крови не совпадает.}
{pattern_discovered: — Серия убийств, когда Кравченко сидел.}
{alibi_confirmed: — Алиби подтверждено свидетелями.}

# speaker: prosecutor
{evidence_for_kravchenko < 3:
    — Сомнения — не доказательства! У нас есть судимый рецидивист!
    
    ~ change_prosecutor(-15)
    -> investigation_hub
}

{evidence_for_kravchenko >= 3:
    Коржов замолкает. Листает ваши материалы.
    
    — Это... серьёзно.
    
    -> prosecutor_considers_evidence
}

=== confront_prosecutor_evidence ===
# mood: professional

Вы раскладываете перед прокурором все доказательства.

{blood_mismatch:
    — Группа крови не совпадает. Это объективный факт.
}

{pattern_discovered:
    — Серийные убийства 1971-1977 годов. Кравченко в это время сидел.
}

{alibi_confirmed:
    — Алиби подтверждено двумя свидетелями с точным временем.
}

-> prosecutor_considers_evidence

=== prosecutor_considers_evidence ===
# mood: tense

Коржов долго молчит. Потом:

# speaker: prosecutor
{evidence_for_kravchenko >= 5:
    — Ладно. Ты прав. Кравченко — не наш человек.
    
    ~ add_score(50)
    -> good_ending_path
}

{evidence_for_kravchenko >= 3 && evidence_for_kravchenko < 5:
    — Убедительно, но... Москва ждёт результата. Кравченко пока оставляем под стражей. Но дело не закрываем.
    
    ~ add_score(30)
    -> neutral_ending_path
}

{evidence_for_kravchenko < 3 && prosecutor_favor < 30:
    — Ты притащил мне это?! — Коржов швыряет папку на стол. — У тебя ничего нет!
    
    # speaker: fetisov
    — Кравченко невиновен. Я в этом уверен.
    
    # speaker: prosecutor
    — Тогда пиши рапорт. Я снимаю тебя с дела.
    
    * [Написать рапорт. Сохранить совесть]
        ~ add_score(20)
        -> conscience_ending
        
    * [Отступить. Остаться на деле]
        ~ change_objectivity(-15)
        -> investigation_hub
}

{evidence_for_kravchenko < 3 && prosecutor_favor >= 30:
    — Недостаточно. Работай дальше.
    
    -> investigation_hub
}

// ═══════════════════════════════════════════════════════════════════════════════
// ИСТЕЧЕНИЕ ВРЕМЕНИ
// ═══════════════════════════════════════════════════════════════════════════════

=== time_expired ===
# mood: pressure

Прокурор Коржов входит.

# speaker: prosecutor
— Время вышло, Фетисов.

{has_strong_evidence():
    Вы показываете собранные доказательства.
    -> prosecutor_considers_evidence
}

{not has_strong_evidence():
    — Ничего? Тогда закрываем дело. Кравченко виновен.
    
    * [Возразить!]
        ~ change_objectivity(5)
        # speaker: fetisov
        — Но у меня сомнения...
        
        # speaker: prosecutor
        — Сомнения — не доказательства.
        -> bad_ending_path
        
    * [Смириться...]
        ~ change_objectivity(-10)
        -> bad_ending_path
}

// ═══════════════════════════════════════════════════════════════════════════════
// СВОДКА — промежуточный итог
// ═══════════════════════════════════════════════════════════════════════════════

=== summary_hub ===
# mood: investigation

СВОДКА ПО ДЕЛУ:

Очков: {score}
Объективность: {objectivity}%
Дней осталось: {days_remaining}

УЛИКИ ЗА КРАВЧЕНКО: {evidence_against_kravchenko}
{clue_prior_conviction: • Предыдущая судимость}

УЛИКИ В ПОЛЬЗУ НЕВИНОВНОСТИ: {evidence_for_kravchenko}
{clue_neighbor_alibi: • Показания соседки}
{clue_timeline_gap: • Временные нестыковки}
{clue_blood_mismatch: • Несовпадение группы крови}
{clue_serial_pattern: • Серия убийств (Кравченко сидел)}
{clue_coins_alibi: • Подтверждение от продавщицы}
{clue_bite_marks: • Деталь об укусах не известна подозреваемому}

{clue_grey_coat || clue_suspicious_records: ДРУГИЕ ПОДОЗРЕВАЕМЫЕ:}
{clue_grey_coat: • Человек в сером пальто}
{clue_suspicious_records: • Снабженец с поддельным алиби}

+ [Продолжить расследование]
    -> investigation_hub
    
+ {has_strong_evidence()} [Идти к прокурору]
    -> confront_prosecutor_evidence

// ═══════════════════════════════════════════════════════════════════════════════
// КОНЦОВКИ
// ═══════════════════════════════════════════════════════════════════════════════

=== good_ending_path ===
# chapter: 6
# mood: hope
# title: Проблеск надежды
# ending: good

МАРТ 1979

Кравченко освобождён из-под стражи.

Вы продолжаете расследование. Человек в сером пальто. Похожие убийства. 
{chikatilo_suspected: Странный снабженец.}

Пазл ещё не сложился. Но вы на верном пути.

═══════════════════════════════════════
ЭПИЗОД 2: ЗАВЕРШЁН

Очки: {score}
Объективность: {objectivity}%

ДОСТИЖЕНИЯ:
{blood_mismatch: ✓ Экспертиза крови}
{pattern_discovered: ✓ Обнаружена серия}
{alibi_confirmed: ✓ Алиби подтверждено}
{grey_coat_found: ✓ Найден новый подозреваемый}

Кравченко: ОСВОБОЖДЁН
═══════════════════════════════════════

Вы сохранили невиновного. Но настоящий убийца на свободе.

Продолжение следует...

-> END

=== neutral_ending_path ===
# chapter: 6
# mood: mystery
# title: Неопределённость
# ending: neutral

Дело повисло. Кравченко — ни осуждён, ни оправдан.

Вы сделали что могли. Но этого недостаточно.

═══════════════════════════════════════
ЭПИЗОД 2: ЗАВЕРШЁН

Очки: {score}
Объективность: {objectivity}%
Кравченко: ПОД СЛЕДСТВИЕМ
═══════════════════════════════════════

История продолжится...

-> END

=== bad_ending_path ===
# chapter: 6
# mood: horror
# title: Судебная ошибка
# ending: bad

СЕНТЯБРЬ 1979

Александр Кравченко признан виновным.
Приговорён к высшей мере наказания.
Приговор приведён в исполнение.

А настоящий убийца — Андрей Чикатило — продолжает убивать.

За следующие 11 лет он убьёт ещё 50 человек.

═══════════════════════════════════════
ЭПИЗОД 2: ЗАВЕРШЁН

Очки: {score}
Объективность: {objectivity}%
Кравченко: КАЗНЁН (невиновен)
═══════════════════════════════════════

Вы выбрали лёгкий путь.
И оплачивать его будут другие.

-> END

=== bad_ending_fast ===
# ending: bad
# mood: horror

-> bad_ending_path

=== conscience_ending ===
# chapter: 6
# mood: professional
# title: Чистая совесть
# ending: conscience

Вы потеряли карьеру. Но сохранили совесть.

В 1990 году, когда настоящий убийца будет пойман, ваши записи помогут восстановить справедливость.

Кравченко реабилитируют. Посмертно.

═══════════════════════════════════════
ЭПИЗОД 2: ЗАВЕРШЁН

Очки: {score}
Объективность: {objectivity}%
Кравченко: РЕАБИЛИТИРОВАН (посмертно)
Ваша совесть: ЧИСТА
═══════════════════════════════════════

Иногда правда стоит всего.

-> END
