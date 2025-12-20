# 🌐 Настройка Cloudflare для Botvik

## Обзор

Cloudflare добавляет:
- ⚡ **CDN** — кэширование статики ближе к пользователям (-50% latency)
- 🛡️ **DDoS защита** — бесплатная защита от атак
- 🔒 **WAF** — Web Application Firewall
- 📊 **Аналитика** — трафик, угрозы, производительность
- 🔐 **SSL** — бесплатные сертификаты

---

## Шаг 1: Создание аккаунта

1. Перейдите на [cloudflare.com](https://cloudflare.com)
2. Нажмите **Sign Up**
3. Введите email и пароль
4. Подтвердите email

---

## Шаг 2: Добавление сайта

1. Нажмите **Add a Site**
2. Введите ваш домен: `botvik.app` (или ваш домен)
3. Выберите план **Free** → Continue
4. Cloudflare просканирует DNS записи

---

## Шаг 3: Настройка DNS

### Для Vercel добавьте записи:

| Type | Name | Content | Proxy Status |
|------|------|---------|--------------|
| `CNAME` | `@` (root) | `cname.vercel-dns.com` | ☁️ Proxied |
| `CNAME` | `www` | `cname.vercel-dns.com` | ☁️ Proxied |

### Важно:
- **Proxied (☁️)** = трафик идёт через Cloudflare
- **DNS only (⚫)** = только DNS, без CDN

---

## Шаг 4: Обновление Nameservers

Cloudflare покажет новые nameservers, например:
```
aria.ns.cloudflare.com
chad.ns.cloudflare.com
```

Обновите их у вашего регистратора домена (например, Namecheap, GoDaddy).

**Время применения:** до 24 часов (обычно 1-2 часа)

---

## Шаг 5: Настройка SSL/TLS

В Cloudflare Dashboard → **SSL/TLS**:

### Overview
- **Encryption mode**: `Full (strict)` ← ВАЖНО!

### Edge Certificates
- **Always Use HTTPS**: ON
- **Automatic HTTPS Rewrites**: ON
- **Minimum TLS Version**: 1.2
- **TLS 1.3**: ON

---

## Шаг 6: Настройка кэширования

### Caching → Configuration

| Setting | Value |
|---------|-------|
| Caching Level | Standard |
| Browser Cache TTL | Respect Existing Headers |
| Always Online | ON |

### Caching → Cache Rules (бесплатно до 10 правил)

#### Правило 1: Статика (агрессивное кэширование)
```
If: URI Path starts with "/frames" OR "/icons" OR "/animations" OR "/rive"
Then: 
  - Cache eligibility: Eligible for cache
  - Edge TTL: 1 month
  - Browser TTL: 1 year
```

#### Правило 2: API (без кэша)
```
If: URI Path starts with "/api"
Then:
  - Cache eligibility: Bypass cache
```

---

## Шаг 7: Настройка безопасности

### Security → WAF

#### Managed Rules (Free tier)
- **Cloudflare Managed Ruleset**: ON (basic protection)

#### Rate Limiting (опционально, 1 бесплатное правило)
```
If: URI Path starts with "/api/auth"
Then: Rate limit to 10 requests per minute per IP
Action: Block for 1 hour
```

### Security → Bots
- **Bot Fight Mode**: ON (бесплатно)
- Блокирует известных плохих ботов

---

## Шаг 8: Оптимизация производительности

### Speed → Optimization

#### Content Optimization
| Feature | Status |
|---------|--------|
| Auto Minify (JS, CSS, HTML) | ON |
| Brotli | ON |
| Early Hints | ON |
| Rocket Loader | OFF (может сломать React) |

#### Image Optimization (Free)
- **Polish**: Lossless (если есть Pro)
- **Mirage**: OFF (для SPA не нужно)

---

## Шаг 9: Настройка в Vercel

### Добавьте домен в Vercel:

1. Vercel Dashboard → Settings → Domains
2. Добавьте ваш домен: `botvik.app`
3. Vercel покажет что нужна CNAME запись (уже настроили в шаге 3)

### Проверьте SSL:
- Vercel автоматически выпустит сертификат
- С Cloudflare Full (strict) — всё работает автоматически

---

## Шаг 10: Проверка

### Проверьте что Cloudflare работает:

```bash
curl -I https://botvik.app
```

Ищите заголовки:
```
cf-ray: xxxxx-XXX
cf-cache-status: HIT (для статики)
server: cloudflare
```

### Проверьте SSL:
```bash
curl -vI https://botvik.app 2>&1 | grep -i "issuer"
```

Должен быть Cloudflare или Let's Encrypt.

---

## Полезные ссылки

- [Cloudflare + Vercel Guide](https://vercel.com/guides/using-cloudflare-with-vercel)
- [Cloudflare Docs](https://developers.cloudflare.com/)
- [Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/)

---

## Troubleshooting

### Ошибка 522 (Connection timed out)
- Убедитесь что SSL mode = `Full (strict)`
- Проверьте что Vercel домен настроен

### Ошибка 526 (Invalid SSL certificate)
- Измените SSL mode с `Full (strict)` на `Full`
- Подождите пока Vercel выпустит сертификат

### Telegram WebApp не загружается
- Проверьте что X-Frame-Options разрешает telegram.org
- Мы уже добавили это в next.config.ts

---

## Статус после настройки

| Метрика | До | После |
|---------|-----|-------|
| Latency (EU) | ~100ms | ~30ms |
| Latency (US) | ~200ms | ~50ms |
| DDoS Protection | ❌ | ✅ |
| Bot Protection | ❌ | ✅ |
| Кэш статики | Vercel Edge | Cloudflare Global |
