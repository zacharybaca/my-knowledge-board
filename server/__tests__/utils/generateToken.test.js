import { describe, it, expect, vi, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import generateToken from "../../utils/generateToken.js";

describe("generateToken", () => {
  afterEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.JWT_SECRET;
  });

  it("signs a JWT containing the userId and sets it as a cookie", () => {
    process.env.JWT_SECRET = "test-secret";
    const res = { cookie: vi.fn() };

    generateToken(res, "user-abc");

    expect(res.cookie).toHaveBeenCalledOnce();
    const [cookieName, tokenValue] = res.cookie.mock.calls[0];
    expect(cookieName).toBe("jwt");

    const decoded = jwt.verify(tokenValue, "test-secret");
    expect(decoded.userId).toBe("user-abc");
  });

  it("sets httpOnly on the cookie", () => {
    process.env.JWT_SECRET = "test-secret";
    const res = { cookie: vi.fn() };

    generateToken(res, "user-abc");

    const [, , options] = res.cookie.mock.calls[0];
    expect(options.httpOnly).toBe(true);
  });

  it("sets maxAge to 30 days in milliseconds", () => {
    process.env.JWT_SECRET = "test-secret";
    const res = { cookie: vi.fn() };

    generateToken(res, "user-abc");

    const [, , options] = res.cookie.mock.calls[0];
    expect(options.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("does not set secure flag outside production", () => {
    process.env.NODE_ENV = "development";
    process.env.JWT_SECRET = "test-secret";
    const res = { cookie: vi.fn() };

    generateToken(res, "user-abc");

    const [, , options] = res.cookie.mock.calls[0];
    expect(options.secure).toBe(false);
  });

  it("sets secure flag in production", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "test-secret";
    const res = { cookie: vi.fn() };

    generateToken(res, "user-abc");

    const [, , options] = res.cookie.mock.calls[0];
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("none");
  });
});
