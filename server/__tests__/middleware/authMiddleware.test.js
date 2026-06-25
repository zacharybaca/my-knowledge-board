import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

// Mock the User model before any imports that use it
vi.mock("../../models/User.js", () => ({
  default: {
    findById: vi.fn(),
  },
}));

import { protect, admin, manager } from "../../middleware/authMiddleware.js";
import User from "../../models/User.js";

const JWT_SECRET = "test-secret";
process.env.JWT_SECRET = JWT_SECRET;

const makeRes = () => {
  const res = { statusCode: 200 };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  return res;
};

const makeNext = () => vi.fn();

const makeReq = (overrides = {}) => ({
  cookies: {},
  originalUrl: "/api/articles",
  ...overrides,
});

const validToken = (userId = "user-id-1") =>
  jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1h" });

const mockUserDoc = {
  _id: "user-id-1",
  role: "Employee",
  isAdmin: false,
};

// ─── protect ─────────────────────────────────────────────────────────────────

describe("protect middleware", () => {
  let res, next;

  beforeEach(() => {
    res = makeRes();
    next = makeNext();
    vi.clearAllMocks();
  });

  it("returns 401 when no JWT cookie is present on a protected route", async () => {
    const req = makeReq({ cookies: {} });

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("calls next() without error for /api/users/me even with no token", async () => {
    const req = makeReq({
      cookies: {},
      originalUrl: "/api/users/me",
    });

    await protect(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it("attaches user and calls next() when token is valid and user exists", async () => {
    User.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(mockUserDoc),
    });

    const req = makeReq({ cookies: { jwt: validToken() } });

    await protect(req, res, next);

    expect(req.user).toEqual(mockUserDoc);
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it("returns 401 when the token signature is invalid", async () => {
    const req = makeReq({ cookies: { jwt: "not.a.valid.token" } });

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("passes through for /api/users/me even when token is invalid", async () => {
    const req = makeReq({
      cookies: { jwt: "bad.token.here" },
      originalUrl: "/api/users/me",
    });

    await protect(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]).toHaveLength(0);
  });
});

// ─── admin ────────────────────────────────────────────────────────────────────

describe("admin middleware", () => {
  it("calls next() for a user with role 'Admin'", () => {
    const req = makeReq({ user: { role: "Admin", isAdmin: false } });
    const res = makeRes();
    const next = makeNext();

    admin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it("calls next() for a user with isAdmin flag set", () => {
    const req = makeReq({ user: { role: "Employee", isAdmin: true } });
    const res = makeRes();
    const next = makeNext();

    admin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("throws 403 for a regular Employee", () => {
    const req = makeReq({ user: { role: "Employee", isAdmin: false } });
    const res = makeRes();
    const next = makeNext();

    expect(() => admin(req, res, next)).toThrow("Not authorized as an admin");
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("throws 403 when req.user is absent", () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    const next = makeNext();

    expect(() => admin(req, res, next)).toThrow();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ─── manager ──────────────────────────────────────────────────────────────────

describe("manager middleware", () => {
  it("calls next() for a Manager", () => {
    const req = makeReq({ user: { role: "Manager" } });
    const res = makeRes();
    const next = makeNext();

    manager(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("calls next() for an Admin (elevated access)", () => {
    const req = makeReq({ user: { role: "Admin" } });
    const res = makeRes();
    const next = makeNext();

    manager(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("throws 403 for an Employee", () => {
    const req = makeReq({ user: { role: "Employee" } });
    const res = makeRes();
    const next = makeNext();

    expect(() => manager(req, res, next)).toThrow(
      "Access denied. Manager role required.",
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("throws 403 when req.user is absent", () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    const next = makeNext();

    expect(() => manager(req, res, next)).toThrow();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
