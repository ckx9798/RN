import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizeOtp } from "./otp";

describe("normalizeEmail", () => {
  it("trims whitespace and lowercases a valid email", () => {
    expect(normalizeEmail(" A@B.co ")).toBe("a@b.co");
  });

  it("returns null for a string without a valid email shape", () => {
    expect(normalizeEmail("abc")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(normalizeEmail("   ")).toBeNull();
  });

  it("returns null for an email missing a domain segment", () => {
    expect(normalizeEmail("a@b")).toBeNull();
  });
});

describe("normalizeOtp", () => {
  it("strips whitespace from a 6-digit code", () => {
    expect(normalizeOtp(" 123 456 ")).toBe("123456");
  });

  it("returns null when the code has fewer than 6 digits", () => {
    expect(normalizeOtp("12345")).toBeNull();
  });

  it("returns null when the code contains non-digit characters", () => {
    expect(normalizeOtp("abcdef")).toBeNull();
  });

  it("returns null when the code has more than 6 digits", () => {
    expect(normalizeOtp("1234567")).toBeNull();
  });
});
