import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  mockCompanyFindById,
  mockCompanyFindOne,
  mockUserFindById,
  mockUserFindOne,
  mockUserCreate,
  mockCloudinaryDestroy,
  mockSendEmail,
} = vi.hoisted(() => ({
  mockCompanyFindById: vi.fn(),
  mockCompanyFindOne: vi.fn(),
  mockUserFindById: vi.fn(),
  mockUserFindOne: vi.fn(),
  mockUserCreate: vi.fn(),
  mockCloudinaryDestroy: vi.fn(),
  mockSendEmail: vi.fn(),
}));

vi.mock("../../models/Company.js", () => ({
  default: {
    findById: mockCompanyFindById,
    findOne: mockCompanyFindOne,
    create: vi.fn(),
  },
}));

vi.mock("../../models/User.js", () => ({
  default: {
    findById: mockUserFindById,
    findOne: mockUserFindOne,
    create: mockUserCreate,
    findByIdAndDelete: vi.fn(),
  },
}));

vi.mock("cloudinary", () => ({
  v2: { uploader: { destroy: mockCloudinaryDestroy } },
}));

vi.mock("../../utils/sendEmail.js", () => ({
  default: mockSendEmail,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  updateCompanyLogo,
  updateCompanyDepartments,
} from "../../controllers/companyController.js";

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
  const companyId = "company-abc";

  function adminUser(overrides = {}) {
    return {
      _id: "admin-1",
      role: ["Admin"],
      companyId: [{ toString: () => companyId }],
      ...overrides,
    };
  }

  function fakeCompany(overrides = {}) {
    return {
      _id: companyId,
      imageUrl: "https://res.cloudinary.com/old/image.png",
      imagePublicId: "old-public-id",
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockCloudinaryDestroy.mockResolvedValue({ result: "ok" });
  });

  it("returns 403 when the caller is not an Admin", async () => {
    const req = {
      params: { id: companyId },
      user: adminUser({ role: ["Manager"] }),
      file: { path: "https://cdn/new.png", filename: "new-public-id" },
    };
    const { res, nextArgs } = await run(updateCompanyLogo, req, makeRes());
    expect(res._code).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 403 when the Admin does not belong to the target workspace", async () => {
    const req = {
      params: { id: "other-company" },
      user: adminUser(),
      file: { path: "https://cdn/new.png", filename: "new-public-id" },
    };
    const { res, nextArgs } = await run(updateCompanyLogo, req, makeRes());
    expect(res._code).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 404 when the company does not exist", async () => {
    mockCompanyFindById.mockResolvedValue(null);
    const req = {
      params: { id: companyId },
      user: adminUser(),
      file: { path: "https://cdn/new.png", filename: "new-public-id" },
    };
    const { res, nextArgs } = await run(updateCompanyLogo, req, makeRes());
    expect(res._code).toBe(404);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 400 when no file is attached to the request", async () => {
    mockCompanyFindById.mockResolvedValue(fakeCompany());
    const req = {
      params: { id: companyId },
      user: adminUser(),
      file: undefined,
    };
    const { res, nextArgs } = await run(updateCompanyLogo, req, makeRes());
    expect(res._code).toBe(400);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("destroys the old Cloudinary image and persists the new one", async () => {
    const company = fakeCompany();
    mockCompanyFindById.mockResolvedValue(company);
    const req = {
      params: { id: companyId },
      user: adminUser(),
      file: { path: "https://cdn/new.png", filename: "new-public-id" },
    };
    const { res } = await run(updateCompanyLogo, req, makeRes());

    expect(mockCloudinaryDestroy).toHaveBeenCalledWith("old-public-id");
    expect(company.imageUrl).toBe("https://cdn/new.png");
    expect(company.imagePublicId).toBe("new-public-id");
    expect(company.save).toHaveBeenCalledOnce();
    expect(res._code).toBe(200);
    expect(res._body).toEqual({
      imageUrl: "https://cdn/new.png",
      imagePublicId: "new-public-id",
    });
  });

  it("skips Cloudinary deletion and still succeeds when company has no prior image", async () => {
    const company = fakeCompany({ imagePublicId: null });
    mockCompanyFindById.mockResolvedValue(company);
    const req = {
      params: { id: companyId },
      user: adminUser(),
      file: { path: "https://cdn/first.png", filename: "first-public-id" },
    };
    await run(updateCompanyLogo, req, makeRes());

    expect(mockCloudinaryDestroy).not.toHaveBeenCalled();
    expect(company.imageUrl).toBe("https://cdn/first.png");
  });

  it("proceeds successfully even when Cloudinary deletion throws", async () => {
    const company = fakeCompany();
    mockCompanyFindById.mockResolvedValue(company);
    mockCloudinaryDestroy.mockRejectedValue(new Error("CDN error"));
    const req = {
      params: { id: companyId },
      user: adminUser(),
      file: { path: "https://cdn/new.png", filename: "new-public-id" },
    };
    const { res } = await run(updateCompanyLogo, req, makeRes());

    // Error is swallowed — company save still happens
    expect(company.save).toHaveBeenCalledOnce();
    expect(res._code).toBe(200);
  });
});

// ── updateCompanyDepartments ──────────────────────────────────────────────────

describe("updateCompanyDepartments", () => {
  const companyId = "company-dept";

  function adminUser(overrides = {}) {
    return {
      _id: "admin-1",
      role: ["Admin"],
      companyId: [{ toString: () => companyId }],
      ...overrides,
    };
  }

  function fakeCompany(overrides = {}) {
    return {
      _id: companyId,
      departments: [],
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when the caller is not an Admin", async () => {
    const req = {
      params: { id: companyId },
      user: adminUser({ role: ["Manager"] }),
      body: { departments: ["Engineering"] },
    };
    const { res, nextArgs } = await run(
      updateCompanyDepartments,
      req,
      makeRes(),
    );
    expect(res._code).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 403 when the Admin does not belong to the target workspace", async () => {
    const req = {
      params: { id: "other-company" },
      user: adminUser(),
      body: { departments: ["Engineering"] },
    };
    const { res, nextArgs } = await run(
      updateCompanyDepartments,
      req,
      makeRes(),
    );
    expect(res._code).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 404 when the company does not exist", async () => {
    mockCompanyFindById.mockResolvedValue(null);
    const req = {
      params: { id: companyId },
      user: adminUser(),
      body: { departments: ["HR"] },
    };
    const { res, nextArgs } = await run(
      updateCompanyDepartments,
      req,
      makeRes(),
    );
    expect(res._code).toBe(404);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("saves the provided departments and returns them", async () => {
    const company = fakeCompany();
    mockCompanyFindById.mockResolvedValue(company);
    const req = {
      params: { id: companyId },
      user: adminUser(),
      body: { departments: ["Engineering", "HR", "Finance"] },
    };
    const { res } = await run(updateCompanyDepartments, req, makeRes());

    expect(company.departments).toEqual(["Engineering", "HR", "Finance"]);
    expect(company.save).toHaveBeenCalledOnce();
    expect(res._code).toBe(200);
    expect(res._body).toEqual({
      departments: ["Engineering", "HR", "Finance"],
    });
  });

  it("trims whitespace from each department name", async () => {
    const company = fakeCompany();
    mockCompanyFindById.mockResolvedValue(company);
    const req = {
      params: { id: companyId },
      user: adminUser(),
      body: { departments: ["  Engineering  ", " HR"] },
    };
    await run(updateCompanyDepartments, req, makeRes());

    expect(company.departments).toEqual(["Engineering", "HR"]);
  });

  it("stores an empty array when departments is not provided", async () => {
    const company = fakeCompany({ departments: ["Old dept"] });
    mockCompanyFindById.mockResolvedValue(company);
    const req = {
      params: { id: companyId },
      user: adminUser(),
      body: {},
    };
    await run(updateCompanyDepartments, req, makeRes());

    expect(company.departments).toEqual([]);
  });
});
