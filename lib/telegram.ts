import crypto from "crypto";

// Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app

export function parseInitData(rawInitData: string) {
  const params = new URLSearchParams(rawInitData);
  const result: Record<string, string> = {};

  params.forEach((value, key) => {
    result[key] = value;
  });

  return result;
}

export function validateInitData(rawInitData: string, botToken: string) {
  if (!rawInitData || !botToken) return false;

  const params = new URLSearchParams(rawInitData);
  const hash = params.get("hash");
  if (!hash) return false;

  // Build data-check-string: sorted key=value pairs excluding hash
  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key === "hash") return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const signature = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

