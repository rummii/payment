// Pure input validation for public client self-signup — no DB, no side
// effects, unit-testable in isolation (see tests/signupValidation.test.ts).

export interface SignupInput {
  name?: unknown;
  email?: unknown;
  password?: unknown;
}

export interface ValidatedSignup {
  name: string;
  email: string;
  password: string;
}

export type SignupValidationResult =
  | { ok: true; value: ValidatedSignup }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate + normalize a public signup payload. Email is trimmed and
 * lowercased (matching the login route's normalization) so lookups and the
 * unique constraint stay consistent.
 */
export function validateSignupInput(input: SignupInput): SignupValidationResult {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (!name) return { ok: false, error: "Name is required" };
  if (name.length > 120) return { ok: false, error: "Name is too long" };
  if (!email) return { ok: false, error: "Email is required" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address" };
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }
  if (password.length > 128) {
    return { ok: false, error: "Password must be at most 128 characters" };
  }

  return { ok: true, value: { name, email, password } };
}