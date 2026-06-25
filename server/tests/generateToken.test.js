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
