import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────

const { mockFindById, mockCloudinaryDestroy } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockCloudinaryDestroy: vi.fn(),
}));

vi.mock("../../models/Company.js", () => ({
  default: { findById: mockFindById },
}));

vi.mock("cloudinary", () => ({
  v2: { uploader: { destroy: mockCloudinaryDestroy } },
}));

// Unused in these tests but required to satisfy the module's imports
vi.mock("../../models/User.js", () => ({
  default: { findById: vi.fn(), create: vi.fn() },
}));

vi.mock("../../utils/sendEmail.js", () => ({
  default: vi.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { updateCompanyLogo } from "../../controllers/companyController.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRes() {
  const res = { statusCode: 200 };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn();
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

function adminUser(companyIds = ["company-1"]) {
  return {
    role: ["Admin"],
    companyId: companyIds.map((id) => ({ toString: () => id })),
  };
}

function fakeCompany({ imagePublicId = null } = {}) {
  return {
    _id: "company-1",
    imageUrl: null,
    imagePublicId,
    save: vi.fn().mockResolvedValue(true),
  };
}

// ── updateCompanyLogo ─────────────────────────────────────────────────────────

describe("updateCompanyLogo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when caller is not an Admin", async () => {
    const req = {
      user: { role: ["Manager"], companyId: [{ toString: () => "company-1" }] },
      params: { id: "company-1" },
      file: { path: "https://cdn/img.jpg", filename: "img_public_id" },
    };
    const { res, nextArgs } = await run(updateCompanyLogo, req, makeRes());
    expect(res.statusCode).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("returns 403 when Admin does not own the target workspace", async () => {
    const req = {
      user: adminUser(["other-company"]),
      params: { id: "company-1" },
      file: { path: "https://cdn/img.jpg", filename: "img_public_id" },
    };
    const { res, nextArgs } = await run(updateCompanyLogo, req, makeRes());
    expect(res.statusCode).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 404 when the company does not exist", async () => {
    mockFindById.mockResolvedValue(null);
    const req = {
      user: adminUser(["company-1"]),
      params: { id: "company-1" },
      file: { path: "https://cdn/img.jpg", filename: "img_public_id" },
    };
    const { res, nextArgs } = await run(updateCompanyLogo, req, makeRes());
    expect(res.statusCode).toBe(404);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 400 when no file is attached to the request", async () => {
    mockFindById.mockResolvedValue(fakeCompany());
    const req = {
      user: adminUser(["company-1"]),
      params: { id: "company-1" },
      file: undefined,
    };
    const { res, nextArgs } = await run(updateCompanyLogo, req, makeRes());
    expect(res.statusCode).toBe(400);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("uploads the new logo and returns imageUrl and imagePublicId", async () => {
    const company = fakeCompany();
    mockFindById.mockResolvedValue(company);
    const req = {
      user: adminUser(["company-1"]),
      params: { id: "company-1" },
      file: { path: "https://cdn/new.jpg", filename: "new_public_id" },
    };
    const { res } = await run(updateCompanyLogo, req, makeRes());

    expect(company.imageUrl).toBe("https://cdn/new.jpg");
    expect(company.imagePublicId).toBe("new_public_id");
    expect(company.save).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
    expect(res.json).toHaveBeenCalledWith({
      imageUrl: "https://cdn/new.jpg",
      imagePublicId: "new_public_id",
    });
  });

  it("deletes the previous Cloudinary asset when one exists before uploading", async () => {
    const company = fakeCompany({ imagePublicId: "old_public_id" });
    mockFindById.mockResolvedValue(company);
    mockCloudinaryDestroy.mockResolvedValue({ result: "ok" });

    const req = {
      user: adminUser(["company-1"]),
      params: { id: "company-1" },
      file: { path: "https://cdn/new.jpg", filename: "new_public_id" },
    };
    await run(updateCompanyLogo, req, makeRes());

    expect(mockCloudinaryDestroy).toHaveBeenCalledWith("old_public_id");
  });

  it("does not call Cloudinary destroy when company has no existing image", async () => {
    const company = fakeCompany({ imagePublicId: null });
    mockFindById.mockResolvedValue(company);

    const req = {
      user: adminUser(["company-1"]),
      params: { id: "company-1" },
      file: { path: "https://cdn/img.jpg", filename: "img_id" },
    };
    await run(updateCompanyLogo, req, makeRes());

    expect(mockCloudinaryDestroy).not.toHaveBeenCalled();
  });
});
