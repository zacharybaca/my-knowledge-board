import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("jsonwebtoken", () => ({
  default: { sign: vi.fn(() => "mocked.jwt.token") },
}));

import jwt from "jsonwebtoken";
import generateToken from "../../utils/generateToken.js";

describe("generateToken", () => {
  let res;

  beforeEach(() => {
    res = { cookie: vi.fn() };
    process.env.JWT_SECRET = "test-secret";
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.JWT_SECRET;
  });

  it("signs a JWT containing the userId", () => {
    generateToken(res, "user123");

    expect(jwt.sign).toHaveBeenCalledWith(
      { userId: "user123" },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );
  });

  it("sets an httpOnly cookie named 'jwt'", () => {
    generateToken(res, "user123");

    const [name, , options] = res.cookie.mock.calls[0];
    expect(name).toBe("jwt");
    expect(options.httpOnly).toBe(true);
  });

  it("sets cookie maxAge to 30 days in milliseconds", () => {
    generateToken(res, "user123");

    const [, , options] = res.cookie.mock.calls[0];
    expect(options.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("sets secure=false and sameSite=lax outside production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    generateToken(res, "user123");

    const [, , options] = res.cookie.mock.calls[0];
    expect(options.secure).toBe(false);
    expect(options.sameSite).toBe("lax");

    process.env.NODE_ENV = originalEnv;
  });

  it("sets secure=true and sameSite=none in production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    generateToken(res, "user123");

    const [, , options] = res.cookie.mock.calls[0];
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("none");

    process.env.NODE_ENV = originalEnv;
  });
});
