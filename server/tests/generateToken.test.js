import { describe, it, expect, vi, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import generateToken from "../utils/generateToken.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeMockRes() {
  return {
    _cookies: {},
    cookie(name, value, options) {
      this._cookies[name] = { value, options };
    },
  };
}

describe("generateToken", () => {
  it("signs a JWT with the userId and writes an httpOnly cookie", () => {
    process.env.JWT_SECRET = "test-secret";
    process.env.NODE_ENV = "development";

    const res = makeMockRes();
    const userId = "abc123";

    generateToken(res, userId);

    const { value, options } = res._cookies["jwt"];

    // Verify the token payload round-trips correctly
    const decoded = jwt.verify(value, "test-secret");
    expect(decoded.userId).toBe(userId);

    // Cookie must be httpOnly
    expect(options.httpOnly).toBe(true);
    // 30-day expiry in milliseconds
    expect(options.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("sets secure=false and sameSite=lax outside production", () => {
    process.env.NODE_ENV = "development";
    process.env.JWT_SECRET = "test-secret";

    const res = makeMockRes();
    generateToken(res, "user1");

    const { options } = res._cookies["jwt"];
    expect(options.secure).toBe(false);
    expect(options.sameSite).toBe("lax");
  });

  it("sets secure=true and sameSite=none in production", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "test-secret";

    const res = makeMockRes();
    generateToken(res, "user1");

    const { options } = res._cookies["jwt"];
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("none");

    // Restore
    process.env.NODE_ENV = "development";
  });
});
