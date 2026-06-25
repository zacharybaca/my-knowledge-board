import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import generateToken from "../../utils/generateToken.js";

const JWT_SECRET = "test-secret";

describe("generateToken", () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    process.env.JWT_SECRET = JWT_SECRET;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  const makeRes = () => {
    const res = {};
    res.cookie = vi.fn();
    return res;
  };

  it("sets a cookie named 'jwt'", () => {
    const res = makeRes();
    generateToken(res, "user123");
    expect(res.cookie.mock.calls[0][0]).toBe("jwt");
  });

  it("token payload contains the supplied userId", () => {
    const res = makeRes();
    generateToken(res, "user123");

    const token = res.cookie.mock.calls[0][1];
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.userId).toBe("user123");
  });

  it("cookie is always httpOnly", () => {
    const res = makeRes();
    generateToken(res, "user123");

    const options = res.cookie.mock.calls[0][2];
    expect(options.httpOnly).toBe(true);
  });

  it("cookie maxAge is 30 days in milliseconds", () => {
    const res = makeRes();
    generateToken(res, "user123");

    const options = res.cookie.mock.calls[0][2];
    expect(options.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("uses secure=true and sameSite=none in production", () => {
    process.env.NODE_ENV = "production";
    const res = makeRes();
    generateToken(res, "user456");

    const options = res.cookie.mock.calls[0][2];
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("none");
  });

  it("uses secure=false and sameSite=lax outside production", () => {
    process.env.NODE_ENV = "development";
    const res = makeRes();
    generateToken(res, "user456");

    const options = res.cookie.mock.calls[0][2];
    expect(options.secure).toBe(false);
    expect(options.sameSite).toBe("lax");
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
