import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockCompanyFindById, mockCloudinaryDestroy } = vi.hoisted(() => ({
  mockCompanyFindById: vi.fn(),
  mockCloudinaryDestroy: vi.fn(),
}));

vi.mock("../../models/Company.js", () => ({
  default: { findById: mockCompanyFindById },
}));

vi.mock("cloudinary", () => ({
  v2: { uploader: { destroy: mockCloudinaryDestroy } },
}));

// sendEmail is imported by companyController but not needed here
vi.mock("../../utils/sendEmail.js", () => ({ default: vi.fn() }));
vi.mock("../../models/User.js", () => ({
  default: { findById: vi.fn(), findOne: vi.fn(), create: vi.fn() },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { updateCompanyLogo } from "../../controllers/companyController.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRes() {
  const res = { _code: 200, _body: null };
  res.status = vi.fn((code) => {
    res._code = code;
    return res;
  });
  res.json = vi.fn((body) => {
    res._body = body;
    return res;
  });
  return res;
}

function run(controller, req, res) {
  return new Promise((resolve) => {
    const done = (...args) => resolve({ res, nextArgs: args });
    const originalJson = res.json.bind(res);
    res.json = vi.fn((...args) => {
      originalJson(...args);
      done();
    });
    const next = vi.fn((...args) => done(...args));
    controller(req, res, next);
  });
}

// ── updateCompanyLogo ─────────────────────────────────────────────────────────

describe("updateCompanyLogo", () => {
  const companyId = "company-001";

  const adminUser = {
    role: ["Admin"],
    companyId: [{ toString: () => companyId }],
  };

  const employeeUser = {
    role: ["Employee"],
    companyId: [{ toString: () => companyId }],
  };

  beforeEach(() => vi.clearAllMocks());

  it("rejects non-Admin users with 403", async () => {
    const req = {
      user: employeeUser,
      params: { id: companyId },
      file: { path: "http://cdn/new.jpg", filename: "new-id" },
    };
    const res = makeRes();

    const { nextArgs } = await run(updateCompanyLogo, req, res);
    expect(res._code).toBe(403);
    expect(nextArgs[0].message).toMatch(/not authorized to update workspace logo/i);
    expect(mockCompanyFindById).not.toHaveBeenCalled();
  });

  it("rejects Admins who do not belong to the target company with 403", async () => {
    const adminOutsider = {
      role: ["Admin"],
      companyId: [{ toString: () => "other-company" }],
    };
    const req = {
      user: adminOutsider,
      params: { id: companyId },
      file: { path: "http://cdn/new.jpg", filename: "new-id" },
    };
    const res = makeRes();

    const { nextArgs } = await run(updateCompanyLogo, req, res);
    expect(res._code).toBe(403);
    expect(nextArgs[0].message).toMatch(/not authorized to update this workspace/i);
  });

  it("returns 404 when the company does not exist", async () => {
    mockCompanyFindById.mockResolvedValue(null);
    const req = {
      user: adminUser,
      params: { id: companyId },
      file: { path: "http://cdn/new.jpg", filename: "new-id" },
    };
    const res = makeRes();

    const { nextArgs } = await run(updateCompanyLogo, req, res);
    expect(res._code).toBe(404);
    expect(nextArgs[0].message).toMatch(/workspace not found/i);
  });

  it("returns 400 when no file is provided", async () => {
    mockCompanyFindById.mockResolvedValue({
      _id: companyId,
      imagePublicId: null,
      save: vi.fn(),
    });
    const req = {
      user: adminUser,
      params: { id: companyId },
      file: undefined,
    };
    const res = makeRes();

    const { nextArgs } = await run(updateCompanyLogo, req, res);
    expect(res._code).toBe(400);
    expect(nextArgs[0].message).toMatch(/no image file provided/i);
  });

  it("saves new logo and returns imageUrl + imagePublicId on success", async () => {
    const fakeCompany = {
      _id: companyId,
      imagePublicId: null,
      imageUrl: null,
      save: vi.fn().mockResolvedValue(true),
    };
    mockCompanyFindById.mockResolvedValue(fakeCompany);

    const req = {
      user: adminUser,
      params: { id: companyId },
      file: { path: "http://cdn/logo.jpg", filename: "logo-public-id" },
    };
    const { res } = await run(updateCompanyLogo, req, makeRes());

    expect(fakeCompany.imageUrl).toBe("http://cdn/logo.jpg");
    expect(fakeCompany.imagePublicId).toBe("logo-public-id");
    expect(fakeCompany.save).toHaveBeenCalled();
    expect(res._body).toEqual({
      imageUrl: "http://cdn/logo.jpg",
      imagePublicId: "logo-public-id",
    });
  });

  it("destroys the old Cloudinary image when one exists", async () => {
    const fakeCompany = {
      _id: companyId,
      imagePublicId: "old-public-id",
      imageUrl: "http://cdn/old.jpg",
      save: vi.fn().mockResolvedValue(true),
    };
    mockCompanyFindById.mockResolvedValue(fakeCompany);
    mockCloudinaryDestroy.mockResolvedValue({ result: "ok" });

    const req = {
      user: adminUser,
      params: { id: companyId },
      file: { path: "http://cdn/new.jpg", filename: "new-public-id" },
    };
    await run(updateCompanyLogo, req, makeRes());

    expect(mockCloudinaryDestroy).toHaveBeenCalledWith("old-public-id");
  });

  it("proceeds even when old-image Cloudinary cleanup fails", async () => {
    const fakeCompany = {
      _id: companyId,
      imagePublicId: "old-public-id",
      imageUrl: "http://cdn/old.jpg",
      save: vi.fn().mockResolvedValue(true),
    };
    mockCompanyFindById.mockResolvedValue(fakeCompany);
    mockCloudinaryDestroy.mockRejectedValue(new Error("CDN error"));

    const req = {
      user: adminUser,
      params: { id: companyId },
      file: { path: "http://cdn/new.jpg", filename: "new-public-id" },
    };
    const { res } = await run(updateCompanyLogo, req, makeRes());

    // Still saved successfully despite CDN error
    expect(fakeCompany.save).toHaveBeenCalled();
    expect(res._code).toBe(200);
  });
});
