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
  });
});
