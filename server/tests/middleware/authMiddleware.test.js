import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Module mocks (hoisted before imports) ────────────────────────────────────

vi.mock("jsonwebtoken", () => ({
  default: { verify: vi.fn() },
}));

vi.mock("../../models/User.js", () => ({
  default: { findById: vi.fn() },
}));

// ── Imports (after mocks are declared) ───────────────────────────────────────

import jwt from "jsonwebtoken";
import User from "../../models/User.js";
import { protect, admin, manager } from "../../middleware/authMiddleware.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRes() {
  const res = { _code: 200 };
  res.status = vi.fn((code) => {
    res._code = code;
    return res;
  });
  return res;
}

/**
 * Runs an express-async-handler-wrapped middleware and resolves once `next`
 * is called, returning { res, nextArgs }.
 */
function run(middleware, req, res) {
  return new Promise((resolve) => {
    const next = vi.fn((...args) => resolve({ res, nextArgs: args }));
    middleware(req, res, next);
  });
}

// ── protect ───────────────────────────────────────────────────────────────────

describe("protect middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes when a valid token resolves to a user", async () => {
    const fakeUser = { _id: "u1", firstName: "Alice" };
    jwt.verify.mockReturnValue({ userId: "u1" });
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(fakeUser) });

    const req = { cookies: { jwt: "valid.token" }, originalUrl: "/api/articles" };
    const res = makeRes();

    const { nextArgs } = await run(protect, req, res);

    expect(nextArgs).toHaveLength(0); // next() called with no error
    expect(req.user).toBe(fakeUser);
  });

  it("returns 401 when no token is present on a protected route", async () => {
    const req = { cookies: {}, originalUrl: "/api/articles" };
    const res = makeRes();

    const { nextArgs } = await run(protect, req, res);

    expect(res._code).toBe(401);
    expect(nextArgs[0]).toBeInstanceOf(Error);
    expect(nextArgs[0].message).toMatch(/no token/i);
  });

  it("passes through with no token on /api/users/me (unauthenticated profile check)", async () => {
    const req = { cookies: {}, originalUrl: "/api/users/me" };
    const res = makeRes();

    const { nextArgs } = await run(protect, req, res);

    expect(nextArgs).toHaveLength(0);
  });

  it("returns 401 when token verification fails on a protected route", async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const req = { cookies: { jwt: "bad.token" }, originalUrl: "/api/articles" };
    const res = makeRes();

    const { nextArgs } = await run(protect, req, res);

    expect(res._code).toBe(401);
    expect(nextArgs[0]).toBeInstanceOf(Error);
    expect(nextArgs[0].message).toMatch(/token failed/i);
  });

  it("passes through on /api/users/me even when token verification fails", async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const req = { cookies: { jwt: "bad.token" }, originalUrl: "/api/users/me" };
    const res = makeRes();

    const { nextArgs } = await run(protect, req, res);

    expect(nextArgs).toHaveLength(0);
  });

  it("returns 401 when token is valid but user no longer exists", async () => {
    jwt.verify.mockReturnValue({ userId: "ghost" });
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });

    const req = { cookies: { jwt: "valid.token" }, originalUrl: "/api/articles" };
    const res = makeRes();

    const { nextArgs } = await run(protect, req, res);

    expect(res._code).toBe(401);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });
});

// ── admin ─────────────────────────────────────────────────────────────────────

describe("admin middleware", () => {
  it("passes when user has isAdmin flag", () => {
    const req = { user: { isAdmin: true, role: ["Employee"] } };
    const res = makeRes();
    const next = vi.fn();

    admin(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("passes when user has role Admin", () => {
    const req = { user: { isAdmin: false, role: ["Admin"] } };
    const res = makeRes();
    const next = vi.fn();

    admin(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("returns 403 when user is only an Employee", () => {
    const req = { user: { isAdmin: false, role: ["Employee"] } };
    const res = makeRes();
    const next = vi.fn();

    expect(() => admin(req, res, next)).toThrow("Not authorized as an admin");
    expect(res._code).toBe(403);
  });

  it("returns 403 when req.user is undefined", () => {
    const req = {};
    const res = makeRes();
    const next = vi.fn();

    expect(() => admin(req, res, next)).toThrow("Not authorized as an admin");
    expect(res._code).toBe(403);
  });
});

// ── manager ───────────────────────────────────────────────────────────────────

describe("manager middleware", () => {
  it("passes when user has role Manager", () => {
    const req = { user: { role: ["Manager"] } };
    const res = makeRes();
    const next = vi.fn();

    manager(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("passes when user has role Admin", () => {
    const req = { user: { role: ["Admin"] } };
    const res = makeRes();
    const next = vi.fn();

    manager(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("returns 403 when user is only an Employee", () => {
    const req = { user: { role: ["Employee"] } };
    const res = makeRes();
    const next = vi.fn();

    expect(() => manager(req, res, next)).toThrow("Manager role required");
    expect(res._code).toBe(403);
  });

  it("returns 403 when req.user is undefined", () => {
    const req = {};
    const res = makeRes();
    const next = vi.fn();

    expect(() => manager(req, res, next)).toThrow("Manager role required");
    expect(res._code).toBe(403);
  });
});
