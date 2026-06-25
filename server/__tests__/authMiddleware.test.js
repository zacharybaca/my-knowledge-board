import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Hoist mocks before any import so the modules see mocked versions
vi.mock("jsonwebtoken", () => ({
  default: { verify: vi.fn() },
}));

vi.mock("../models/User.js", () => ({
  default: { findById: vi.fn() },
}));

import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect, admin, manager } from "../middleware/authMiddleware.js";

const makeReq = (overrides = {}) => ({
  cookies: {},
  originalUrl: "/api/articles",
  ...overrides,
});

const makeRes = () => ({
  status: vi.fn().mockReturnThis(),
});

describe("protect middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("calls next(error) with 401 when no JWT cookie is present", async () => {
    const next = vi.fn();
    await protect(makeReq({ cookies: {} }), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/no token/i);
  });

  it("calls next(error) with 401 when JWT verification fails on a protected route", async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error("invalid signature");
    });
    const next = vi.fn();
    const res = makeRes();
    await protect(
      makeReq({ cookies: { jwt: "bad.token.here" } }),
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    const err = next.mock.calls[0][0];
    expect(err.message).toMatch(/token failed/i);
  });

  it("passes through on /api/users/me even when JWT verification fails", async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error("invalid");
    });
    const next = vi.fn();
    await protect(
      makeReq({
        cookies: { jwt: "bad.token.here" },
        originalUrl: "/api/users/me",
      }),
      makeRes(),
      next,
    );
    // next() called with no error — unauthenticated /me check is allowed
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it("calls next() and attaches user to req when token and user are valid", async () => {
    const fakeUser = { _id: "u1", role: ["Employee"] };
    jwt.verify.mockReturnValue({ userId: "u1" });
    // findById returns a Mongoose-style query object with .select()
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(fakeUser) });

    const next = vi.fn();
    const req = makeReq({ cookies: { jwt: "valid.token" } });
    await protect(req, makeRes(), next);

    expect(req.user).toBe(fakeUser);
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it("calls next(error) with 401 when token is valid but user no longer exists in DB", async () => {
    jwt.verify.mockReturnValue({ userId: "deleted-user" });
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });

    const next = vi.fn();
    const res = makeRes();
    await protect(makeReq({ cookies: { jwt: "valid.token" } }), res, next);

    // Falls through to the "no token" branch because req.user is falsy
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
  });
});

describe("admin middleware", () => {
  it("calls next() for a user with isAdmin=true", () => {
    const next = vi.fn();
    admin({ user: { isAdmin: true } }, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it("calls next() for a user whose role array includes 'Admin'", () => {
    const next = vi.fn();
    admin({ user: { role: "Admin" } }, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("throws 403 for a non-admin user", () => {
    const next = vi.fn();
    const res = makeRes();
    expect(() => admin({ user: { role: "Employee", isAdmin: false } }, res, next)).toThrow();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("throws 403 when req.user is absent", () => {
    const next = vi.fn();
    const res = makeRes();
    expect(() => admin({}, res, next)).toThrow();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("manager middleware", () => {
  it("calls next() for a user with role 'Manager'", () => {
    const next = vi.fn();
    manager({ user: { role: "Manager" } }, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("calls next() for a user with role 'Admin'", () => {
    const next = vi.fn();
    manager({ user: { role: "Admin" } }, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("throws 403 for an Employee", () => {
    const next = vi.fn();
    const res = makeRes();
    expect(() => manager({ user: { role: "Employee" } }, res, next)).toThrow();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("throws 403 when req.user is absent", () => {
    const next = vi.fn();
    const res = makeRes();
    expect(() => manager({}, res, next)).toThrow();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
