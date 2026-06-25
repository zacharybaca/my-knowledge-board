import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";

// Mock cloudinary so importing User.js doesn't fail without credentials
vi.mock("cloudinary", () => ({
  v2: { uploader: { destroy: vi.fn() } },
}));

import User from "../../models/User.js";

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the SHA-256 hex digest of the given string — mirrors the hashing
 * done inside the User model methods.
 */
function sha256(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

// ── getResetPasswordToken ─────────────────────────────────────────────────────

describe("User.schema.methods.getResetPasswordToken", () => {
  const { getResetPasswordToken } = User.schema.methods;

  it("returns a 40-character hex string", () => {
    const ctx = {};
    const token = getResetPasswordToken.call(ctx);
    expect(typeof token).toBe("string");
    expect(token).toMatch(/^[0-9a-f]{40}$/);
  });

  it("stores the SHA-256 hash of the returned token on the instance", () => {
    const ctx = {};
    const rawToken = getResetPasswordToken.call(ctx);
    expect(ctx.resetPasswordToken).toBe(sha256(rawToken));
  });

  it("sets resetPasswordExpire ~10 minutes in the future", () => {
    const ctx = {};
    const before = Date.now();
    getResetPasswordToken.call(ctx);
    const after = Date.now();

    const tenMinutes = 10 * 60 * 1000;
    expect(ctx.resetPasswordExpire).toBeGreaterThanOrEqual(
      before + tenMinutes - 50,
    );
    expect(ctx.resetPasswordExpire).toBeLessThanOrEqual(
      after + tenMinutes + 50,
    );
  });

  it("each call produces a different token", () => {
    const ctx1 = {};
    const ctx2 = {};
    const t1 = getResetPasswordToken.call(ctx1);
    const t2 = getResetPasswordToken.call(ctx2);
    expect(t1).not.toBe(t2);
  });
});

// ── getVerificationToken ──────────────────────────────────────────────────────

describe("User.schema.methods.getVerificationToken", () => {
  const { getVerificationToken } = User.schema.methods;

  it("returns a 40-character hex string", () => {
    const ctx = {};
    const token = getVerificationToken.call(ctx);
    expect(typeof token).toBe("string");
    expect(token).toMatch(/^[0-9a-f]{40}$/);
  });

  it("stores the SHA-256 hash of the returned token on the instance", () => {
    const ctx = {};
    const rawToken = getVerificationToken.call(ctx);
    expect(ctx.verificationToken).toBe(sha256(rawToken));
  });

  it("sets verificationExpire ~24 hours in the future", () => {
    const ctx = {};
    const before = Date.now();
    getVerificationToken.call(ctx);
    const after = Date.now();

    const twentyFourHours = 24 * 60 * 60 * 1000;
    expect(ctx.verificationExpire).toBeGreaterThanOrEqual(
      before + twentyFourHours - 50,
    );
    expect(ctx.verificationExpire).toBeLessThanOrEqual(
      after + twentyFourHours + 50,
    );
  });
});
