import { describe, it } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import generateToken from "../utils/generateToken.js";

const JWT_SECRET = "test-secret-key";

const makeRes = () => {
  const cookies = {};
  return {
    cookies,
    cookie(name, value, options) {
      cookies[name] = { value, options };
    },
  };
};

describe("generateToken", () => {
  it("sets an httpOnly cookie named 'jwt'", () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const res = makeRes();
    generateToken(res, "user123");
    assert.ok(res.cookies.jwt, "cookie named jwt should be set");
    assert.ok(res.cookies.jwt.options.httpOnly, "cookie must be httpOnly");
  });

  it("embeds the userId in the token payload", () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const res = makeRes();
    generateToken(res, "user-abc");
    const { value } = res.cookies.jwt;
    const decoded = jwt.verify(value, JWT_SECRET);
    assert.equal(decoded.userId, "user-abc");
  });

  it("sets a 30-day maxAge on the cookie", () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const res = makeRes();
    generateToken(res, "user-xyz");
    const expectedMs = 30 * 24 * 60 * 60 * 1000;
    assert.equal(res.cookies.jwt.options.maxAge, expectedMs);
  });

  it("marks cookie secure=false in non-production", () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    process.env.JWT_SECRET = JWT_SECRET;
    const res = makeRes();
    generateToken(res, "user-dev");
    assert.equal(res.cookies.jwt.options.secure, false);
    process.env.NODE_ENV = prevEnv;
  });

  it("marks cookie secure=true in production", () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = JWT_SECRET;
    const res = makeRes();
    generateToken(res, "user-prod");
    assert.equal(res.cookies.jwt.options.secure, true);
    process.env.NODE_ENV = prevEnv;
  });

  it("uses sameSite=lax in development and none in production", () => {
    process.env.JWT_SECRET = JWT_SECRET;

    process.env.NODE_ENV = "development";
    const resDev = makeRes();
    generateToken(resDev, "u1");
    assert.equal(resDev.cookies.jwt.options.sameSite, "lax");

    process.env.NODE_ENV = "production";
    const resProd = makeRes();
    generateToken(resProd, "u2");
    assert.equal(resProd.cookies.jwt.options.sameSite, "none");
import { describe, it, expect, vi, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import generateToken from "../utils/generateToken.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeMockRes() {
  return {
/**
 * Tests for generateToken utility.
 *
 * generateToken(res, userId) signs a JWT and writes it as an HttpOnly cookie.
 * We verify the cookie attributes and that the payload decodes to the expected userId.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import generateToken from "../utils/generateToken.js";

const TEST_SECRET = "test-jwt-secret";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function makeRes() {
  const res = {
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
  return res;
}

describe("generateToken", () => {
  let originalSecret;
  let originalEnv;

  beforeEach(() => {
    originalSecret = process.env.JWT_SECRET;
    originalEnv = process.env.NODE_ENV;
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    process.env.NODE_ENV = originalEnv;
  });

  it("sets a cookie named 'jwt'", () => {
    const res = makeRes();
    generateToken(res, "user-id-1");
    assert.ok("jwt" in res._cookies, "Expected a cookie named 'jwt' to be set");
  });

  it("encodes the userId in the JWT payload", () => {
    const res = makeRes();
    const userId = "507f1f77bcf86cd799439011";
    generateToken(res, userId);
    const { value } = res._cookies.jwt;
    const decoded = jwt.verify(value, TEST_SECRET);
    assert.strictEqual(decoded.userId, userId);
  });

  it("sets maxAge to 30 days in milliseconds", () => {
    const res = makeRes();
    generateToken(res, "user-id-2");
    const { options } = res._cookies.jwt;
    assert.strictEqual(options.maxAge, THIRTY_DAYS_MS);
  });

  it("marks the cookie as httpOnly", () => {
    const res = makeRes();
    generateToken(res, "user-id-3");
    const { options } = res._cookies.jwt;
    assert.strictEqual(options.httpOnly, true);
  });

  it("sets secure:true and sameSite:'none' in production", () => {
    process.env.NODE_ENV = "production";
    const res = makeRes();
    generateToken(res, "user-id-4");
    const { options } = res._cookies.jwt;
    assert.strictEqual(options.secure, true);
    assert.strictEqual(options.sameSite, "none");
  });

  it("sets secure:false and sameSite:'lax' outside of production", () => {
    process.env.NODE_ENV = "development";
    const res = makeRes();
    generateToken(res, "user-id-5");
    const { options } = res._cookies.jwt;
    assert.strictEqual(options.secure, false);
    assert.strictEqual(options.sameSite, "lax");
  });
});
