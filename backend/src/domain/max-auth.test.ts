import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { AuthenticationError, validateMaxInitData } from "./max-auth.js";

function signedData(botToken: string, timestamp: number): string {
  const values = {
    auth_date: String(timestamp),
    user: JSON.stringify({ id: 42, first_name: "Анна" }),
  };
  const checkString = Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(checkString).digest("hex");
  return new URLSearchParams({ ...values, hash }).toString();
}

describe("validateMaxInitData", () => {
  const now = new Date("2026-09-17T12:00:00.000Z");
  const token = "test-bot-token-with-enough-characters";

  it("returns a verified MAX identity", () => {
    const identity = validateMaxInitData(signedData(token, now.getTime() / 1000), token, now);
    expect(identity).toEqual({ id: "42", firstName: "Анна", development: false });
  });

  it("rejects modified data", () => {
    const data = signedData(token, now.getTime() / 1000).replace("%D0%90%D0%BD%D0%BD%D0%B0", "%D0%98%D0%B2%D0%B0%D0%BD");
    expect(() => validateMaxInitData(data, token, now)).toThrow(AuthenticationError);
  });
});

