import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it.each([
    ["3001234567", "+573001234567"],
    ["300 123 4567", "+573001234567"],
    ["300-123-4567", "+573001234567"],
    ["+57 300 123 4567", "+573001234567"],
    ["573001234567", "+573001234567"],
    ["+1 305 555 0101", "+13055550101"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each(["", "12345", "6011234567", "30012345", "+57 1 234", "abc"])("rechaza %j", (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});
