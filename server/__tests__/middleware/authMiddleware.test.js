import { describe, it, expect, vi, beforeEach } from "vitest";

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
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const makeReq = (overrides = {}) => ({
  cookies: { jwt: "valid-token" },
  originalUrl: "/api/articles",
  ...overrides,
});

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
