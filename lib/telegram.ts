import crypto from "crypto";

// Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app

type ValidateSuccess = {
  ok: true;
  data: {
    user?: string;
    auth_date?: number;
    query: URLSearchParams;
  };
};

type ValidateFail = {
  ok: false;
  reason: "NO_INIT_DATA" | "NO_BOT_TOKEN" | "PARSE_ERROR" | "HASH_MISMATCH" | "EXPIRED";
};

export function parseInitData(rawInitData: string) {
  const params = new URLSearchParams(rawInitData);
  const result: Record<string, string> = {};

  params.forEach((value, key) => {
    result[key] = value;
  });

  return result;
}

export function validateInitData(rawInitData: string, botToken: string): ValidateSuccess | ValidateFail {
  if (!rawInitData) return { ok: false, reason: "NO_INIT_DATA" };
  if (!botToken) return { ok: false, reason: "NO_BOT_TOKEN" };

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(rawInitData);
  } catch {
    return { ok: false, reason: "PARSE_ERROR" };
  }

  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "HASH_MISMATCH" };

  // Build data-check-string: sorted key=value pairs excluding hash
  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key === "hash") return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  // For Web Apps / Mini Apps: HMAC-SHA256 with "WebAppData" as key
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const signature = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  try {
    const isValid = crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(hash, "hex"));
    if (!isValid) return { ok: false, reason: "HASH_MISMATCH" };
  } catch {
    return { ok: false, reason: "HASH_MISMATCH" };
  }

  // Optional: auth_date expiration (24h)
  const authDate = Number(params.get("auth_date") ?? 0);
  if (authDate > 0) {
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 24 * 60 * 60) {
      return { ok: false, reason: "EXPIRED" };
    }
  }

  return {
    ok: true,
    data: {
      user: params.get("user") ?? undefined,
      auth_date: authDate || undefined,
      query: params,
    },
  };
}

