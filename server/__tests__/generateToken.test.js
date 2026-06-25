import { describe, it, expect, vi, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import generateToken from "../utils/generateToken.js";

describe("generateToken", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("sets a cookie named 'jwt' on the response", () => {
    process.env.JWT_SECRET = "test-secret";
    const res = { cookie: vi.fn() };
    generateToken(res, "user123");
    expect(res.cookie).toHaveBeenCalledOnce();
    expect(res.cookie.mock.calls[0][0]).toBe("jwt");
  });

  it("encodes the userId in the JWT payload", () => {
    process.env.JWT_SECRET = "test-secret";
    const res = { cookie: vi.fn() };
    generateToken(res, "user-abc");
    const token = res.cookie.mock.calls[0][1];
    const decoded = jwt.verify(token, "test-secret");
    expect(decoded.userId).toBe("user-abc");
  });

  it("sets httpOnly=true on the cookie", () => {
    process.env.JWT_SECRET = "test-secret";
    const res = { cookie: vi.fn() };
    generateToken(res, "user123");
    const options = res.cookie.mock.calls[0][2];
    expect(options.httpOnly).toBe(true);
  });

  it("uses secure=false and sameSite=lax outside of production", () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test-secret";
    const res = { cookie: vi.fn() };
    generateToken(res, "user123");
    const options = res.cookie.mock.calls[0][2];
    expect(options.secure).toBe(false);
    expect(options.sameSite).toBe("lax");
  });

  it("uses secure=true and sameSite=none in production", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "test-secret";
    const res = { cookie: vi.fn() };
    generateToken(res, "user123");
    const options = res.cookie.mock.calls[0][2];
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("none");
  });

  it("sets a maxAge corresponding to 30 days", () => {
    process.env.JWT_SECRET = "test-secret";
    const res = { cookie: vi.fn() };
    generateToken(res, "user123");
    const options = res.cookie.mock.calls[0][2];
    expect(options.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
