import { describe, expect, it } from "vitest";
import { validateSignupInput } from "@/lib/signupValidation";

const base = {
  name: "Jane Doe",
  email: "Jane@Example.com",
  password: "supersecret1",
};

describe("validateSignupInput", () => {
  it("accepts a valid input and normalizes the email", () => {
    const r = validateSignupInput(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.email).toBe("jane@example.com");
      expect(r.value.name).toBe("Jane Doe");
      expect(r.value.password).toBe("supersecret1");
    }
  });

  it("trims whitespace around name and email", () => {
    const r = validateSignupInput({
      ...base,
      name: "  Jane Doe  ",
      email: "  jane@example.com ",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("Jane Doe");
      expect(r.value.email).toBe("jane@example.com");
    }
  });

  it("rejects missing or blank name", () => {
    expect(validateSignupInput({ ...base, name: "" }).ok).toBe(false);
    expect(validateSignupInput({ ...base, name: "   " }).ok).toBe(false);
    expect(validateSignupInput({ ...base, name: undefined }).ok).toBe(false);
    expect(validateSignupInput({ ...base, name: 42 }).ok).toBe(false);
  });

  it("rejects invalid email formats", () => {
    expect(validateSignupInput({ ...base, email: "not-an-email" }).ok).toBe(false);
    expect(validateSignupInput({ ...base, email: "missing@tld" }).ok).toBe(false);
    expect(validateSignupInput({ ...base, email: "" }).ok).toBe(false);
    expect(validateSignupInput({ ...base, email: undefined }).ok).toBe(false);
  });

  it("rejects short passwords", () => {
    expect(validateSignupInput({ ...base, password: "1234567" }).ok).toBe(false);
    expect(validateSignupInput({ ...base, password: "" }).ok).toBe(false);
    expect(validateSignupInput({ ...base, password: undefined }).ok).toBe(false);
  });

  it("accepts exactly 8-character passwords", () => {
    const r = validateSignupInput({ ...base, password: "12345678" });
    expect(r.ok).toBe(true);
  });

  it("rejects oversized passwords", () => {
    expect(validateSignupInput({ ...base, password: "x".repeat(129) }).ok).toBe(false);
  });

  it("returns a friendly error message on the first failure", () => {
    const r = validateSignupInput({ name: "", email: "bad", password: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Name is required");
  });
});