/**
 * Telegram Stars Payment Integration
 * Docs: https://core.telegram.org/bots/payments
 * 
 * Telegram Stars (XTR) - внутренняя валюта Telegram для Mini Apps
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface InvoiceParams {
  title: string;
  description: string;
  payload: string;           // JSON с данными покупки (userId, itemId)
  currency: "XTR";           // Telegram Stars
  prices: LabeledPrice[];
  photo_url?: string;        // Превью товара
  photo_width?: number;
  photo_height?: number;
}

export interface LabeledPrice {
  label: string;
  amount: number;            // Количество Stars (1 Star = 1)
}

export interface CreateInvoiceLinkResponse {
  ok: boolean;
  result?: string;           // URL для оплаты
  error_code?: number;
  description?: string;
}

export interface PreCheckoutQuery {
  id: string;
  from: TelegramUser;
  currency: string;
  total_amount: number;
  invoice_payload: string;
}

export interface SuccessfulPayment {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  telegram_payment_charge_id: string;
  provider_payment_charge_id: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramUpdate {
  update_id: number;
  pre_checkout_query?: PreCheckoutQuery;
  message?: {
    from: TelegramUser;
    successful_payment?: SuccessfulPayment;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Создать ссылку для оплаты через Telegram Stars
 */
export async function createInvoiceLink(params: InvoiceParams): Promise<CreateInvoiceLinkResponse> {
  const response = await fetch(`${TELEGRAM_API}/createInvoiceLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: params.title,
      description: params.description,
      payload: params.payload,
      provider_token: "",     // Пусто для Telegram Stars
      currency: params.currency,
      prices: params.prices,
      photo_url: params.photo_url,
      photo_width: params.photo_width,
      photo_height: params.photo_height,
    }),
  });

  const data = await response.json();
  
  if (!data.ok) {
    console.error("[telegram-payments] createInvoiceLink failed:", data);
  }
  
  return data;
}

/**
 * Подтвердить pre-checkout запрос (обязательно для завершения платежа)
 */
export async function answerPreCheckoutQuery(
  preCheckoutQueryId: string,
  ok: boolean,
  errorMessage?: string
): Promise<boolean> {
  const response = await fetch(`${TELEGRAM_API}/answerPreCheckoutQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pre_checkout_query_id: preCheckoutQueryId,
      ok,
      error_message: errorMessage,
    }),
  });

  const data = await response.json();
  
  if (!data.ok) {
    console.error("[telegram-payments] answerPreCheckoutQuery failed:", data);
  }
  
  return data.ok;
}

/**
 * Отправить сообщение пользователю о успешной покупке
 */
export async function sendPaymentConfirmation(
  chatId: number,
  itemTitle: string
): Promise<boolean> {
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `🎉 Поздравляем! Вы приобрели "${itemTitle}"!\n\nРамка уже доступна в вашем инвентаре. Зайдите в магазин, чтобы надеть её.`,
      parse_mode: "HTML",
    }),
  });

  const data = await response.json();
  return data.ok;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYLOAD HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export interface PaymentPayload {
  userId: number;
  itemId: number;
  purchaseId: number;
  timestamp: number;
}

export function createPayload(data: Omit<PaymentPayload, "timestamp">): string {
  const payload: PaymentPayload = {
    ...data,
    timestamp: Date.now(),
  };
  return JSON.stringify(payload);
}

export function parsePayload(payloadString: string): PaymentPayload | null {
  try {
    return JSON.parse(payloadString);
  } catch {
    console.error("[telegram-payments] Failed to parse payload:", payloadString);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Проверить что запрос пришёл от Telegram
 * В production рекомендуется использовать secret_token в setWebhook
 */
export function isValidTelegramRequest(
  secretToken: string | null,
  headerToken: string | null
): boolean {
  if (!secretToken) return true; // Если токен не настроен, пропускаем
  return secretToken === headerToken;
}
