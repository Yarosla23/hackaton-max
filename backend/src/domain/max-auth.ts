import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const maxUserSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  first_name: z.string().min(1).max(120),
});

export type Identity = {
  id: string;
  firstName: string;
  development: boolean;
};

export class AuthenticationError extends Error {}

export function validateMaxInitData(
  initData: string,
  botToken: string,
  now: Date = new Date(),
): Identity {
  const pairs = initData.split("&").map((pair) => {
    const separator = pair.indexOf("=");
    if (separator === -1) {
      throw new AuthenticationError("Malformed MAX initialization data");
    }

    return [
      pair.slice(0, separator),
      decodeURIComponent(pair.slice(separator + 1)),
    ] as const;
  });

  const keys = pairs.map(([key]) => key);
  if (new Set(keys).size !== keys.length) {
    throw new AuthenticationError("Duplicate MAX initialization parameter");
  }

  const receivedHash = pairs.find(([key]) => key === "hash")?.[1];
  const authDateValue = pairs.find(([key]) => key === "auth_date")?.[1];
  const userValue = pairs.find(([key]) => key === "user")?.[1];

  if (!receivedHash || !authDateValue || !userValue) {
    throw new AuthenticationError("Incomplete MAX initialization data");
  }

  const authDate = z.coerce.number().int().positive().parse(authDateValue);
  const ageSeconds = Math.floor(now.getTime() / 1000) - authDate;
  if (ageSeconds < -60 || ageSeconds > 3600) {
    throw new AuthenticationError("MAX initialization data has expired");
  }

  const checkString = pairs
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");
  const received = Buffer.from(receivedHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new AuthenticationError("Invalid MAX initialization signature");
  }

  const user = maxUserSchema.parse(JSON.parse(userValue));
  return { id: user.id, firstName: user.first_name, development: false };
}
