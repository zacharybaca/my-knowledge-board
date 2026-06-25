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


// ── Use vi.hoisted so mock variables are available when vi.mock factories run ─
const { mockFindById, mockVerify } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockVerify: vi.fn(),
}));

vi.mock("../../models/User.js", () => ({
  default: { findById: mockFindById },
}));

vi.mock("jsonwebtoken", () => ({
  default: { verify: mockVerify },
}));

import { protect, admin, manager } from "../../middleware/authMiddleware.js";

// ── Helpers ────────────────────────────────────────────────────────────────
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
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const makeReq = (overrides = {}) => ({
  cookies: { jwt: "valid-token" },
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
// asyncHandler forwards errors via next(err); helper asserts that pattern.
const expectProtectRejection = (next, res, expectedStatus) => {
  const errorArg = next.mock.calls[0]?.[0];
  expect(errorArg).toBeInstanceOf(Error);
  expect(res.statusCode).toBe(expectedStatus);
};

// ── protect ────────────────────────────────────────────────────────────────
describe("protect middleware", () => {
  const fakeUser = { _id: "user123", firstName: "Alice" };

  beforeEach(() => {
    mockVerify.mockReset();
    mockFindById.mockReset();
  });

  it("attaches req.user and calls next() for a valid token", async () => {
    mockVerify.mockReturnValue({ userId: "user123" });
    mockFindById.mockReturnValue({ select: vi.fn().mockResolvedValue(fakeUser) });
    const next = vi.fn();
    const req = makeReq();

    await protect(req, makeRes(), next);

    expect(req.user).toEqual(fakeUser);
    expect(next).toHaveBeenCalledWith(); // called with no args → success
  });

  it("returns 401 when no cookie is present", async () => {
    const next = vi.fn();
    const req = makeReq({ cookies: {} });
    const res = makeRes();

    await protect(req, res, next);

    expectProtectRejection(next, res, 401);
    expect(next.mock.calls[0][0].message).toMatch(/no token/i);
  });

  it("returns 401 when token verification fails", async () => {
    mockVerify.mockImplementation(() => { throw new Error("bad sig"); });
    const next = vi.fn();
    const req = makeReq();
    const res = makeRes();

    await protect(req, res, next);

    expectProtectRejection(next, res, 401);
    expect(next.mock.calls[0][0].message).toMatch(/token failed/i);
  });

  it("allows /api/users/me through even without a token", async () => {
    const next = vi.fn();
    const req = makeReq({ cookies: {}, originalUrl: "/api/users/me" });
    await protect(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith(); // success, no error arg
  });
});

// ── admin guard ────────────────────────────────────────────────────────────
describe("admin middleware", () => {
  it("calls next() when user has isAdmin flag", () => {
    const next = vi.fn();
    admin({ user: { isAdmin: true, role: "Employee" } }, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("calls next() when user role is 'Admin'", () => {
    const next = vi.fn();
    admin({ user: { role: "Admin" } }, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("returns 403 for non-admin users", () => {
    const next = vi.fn();
    const res = makeRes();
    expect(() => admin({ user: { role: "Employee" } }, res, next)).toThrow();
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("returns 403 when user is absent", () => {
    const next = vi.fn();
    const res = makeRes();
    expect(() => admin({ user: null }, res, next)).toThrow();
    expect(res.statusCode).toBe(403);
  });
});

// ── manager guard ──────────────────────────────────────────────────────────
describe("manager middleware", () => {
  it("calls next() for Admin role", () => {
    const next = vi.fn();
    manager({ user: { role: "Admin" } }, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("calls next() for Manager role", () => {
    const next = vi.fn();
    manager({ user: { role: "Manager" } }, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("returns 403 for Employee role", () => {
    const next = vi.fn();
    const res = makeRes();
    expect(() => manager({ user: { role: "Employee" } }, res, next)).toThrow();
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
