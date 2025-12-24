import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Политика конфиденциальности Botvik — Telegram Mini App",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Политика конфиденциальности
            </h1>
            <p className="text-gray-500">
              Последнее обновление: {new Date().toLocaleDateString("ru-RU")}
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-slate max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                1. Общие положения
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Настоящая Политика конфиденциальности описывает, как Botvik 
                (далее — «Приложение», «мы») собирает, использует и защищает 
                информацию пользователей Telegram Mini App.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                2. Какие данные мы собираем
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                При использовании Приложения мы получаем следующие данные из Telegram:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Telegram ID (уникальный идентификатор)</li>
                <li>Имя пользователя (username)</li>
                <li>Имя и фамилия (если указаны в профиле)</li>
                <li>Фото профиля (URL)</li>
                <li>Языковые настройки</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                Также мы сохраняем данные о вашей активности в приложении:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Результаты прохождения квизов</li>
                <li>Достижения и прогресс</li>
                <li>Позиции в рейтингах</li>
                <li>История покупок</li>
                <li>Сообщения в чате</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                3. Как мы используем данные
              </h2>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Для идентификации в приложении</li>
                <li>Для сохранения прогресса и достижений</li>
                <li>Для формирования рейтингов</li>
                <li>Для отправки уведомлений (с вашего согласия)</li>
                <li>Для улучшения качества сервиса</li>
                <li>Для предотвращения мошенничества</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                4. Хранение и защита данных
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Ваши данные хранятся на защищённых серверах с использованием 
                современных технологий шифрования. Мы не передаём ваши 
                персональные данные третьим лицам, за исключением случаев, 
                предусмотренных законодательством.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                5. Ваши права (GDPR)
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                В соответствии с GDPR вы имеете право:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>
                  <strong>Право на доступ</strong> — запросить копию ваших данных
                </li>
                <li>
                  <strong>Право на исправление</strong> — обновить неточные данные
                </li>
                <li>
                  <strong>Право на удаление</strong> — полностью удалить ваш аккаунт 
                  и все связанные данные
                </li>
                <li>
                  <strong>Право на ограничение обработки</strong> — приостановить 
                  обработку ваших данных
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                6. Удаление аккаунта
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Вы можете удалить свой аккаунт и все связанные данные в любой момент 
                через раздел «Профиль» → «Настройки» → «Удалить аккаунт». 
                Это действие необратимо — все ваши данные будут полностью удалены 
                с наших серверов.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                7. Аналитика
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Мы используем сервисы аналитики (Sentry, PostHog) для улучшения 
                качества приложения. Эти сервисы собирают анонимизированные данные 
                об использовании приложения и ошибках.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                8. Контакты
              </h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                По вопросам конфиденциальности вы можете связаться с нами:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>
                  Telegram: <a href="https://t.me/botvik_support" 
                  className="text-indigo-600 hover:underline">@botvik_support</a>
                </li>
                <li>
                  Email: <a href="mailto:privacy@botvik.app" 
                  className="text-indigo-600 hover:underline">privacy@botvik.app</a>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                9. Изменения политики
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Мы можем обновлять эту Политику конфиденциальности. 
                При существенных изменениях мы уведомим вас через приложение. 
                Рекомендуем периодически проверять эту страницу.
              </p>
            </section>
          </div>

          {/* Back link */}
          <div className="mt-10 pt-8 border-t border-gray-200 text-center">
            <Link
              href="/miniapp"
              className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium"
            >
              ← Вернуться в приложение
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

