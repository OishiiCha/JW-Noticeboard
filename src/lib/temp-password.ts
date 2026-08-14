import { randomInt } from "crypto";

// Unambiguous characters (no 0/O, 1/I/L) for easy reading/typing
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateTempPassword(length = 5): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CHARSET[randomInt(0, CHARSET.length)];
  }
  return out;
}
