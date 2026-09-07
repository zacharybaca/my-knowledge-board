import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindById, mockDestroy } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockDestroy: vi.fn(),
}));

vi.mock("../../models/Company.js", () => ({
  default: { findById: mockFindById },
}));

vi.mock("../../models/User.js", () => ({
  default: {},
}));

vi.mock("cloudinary", () => ({
  v2: { uploader: { destroy: mockDestroy } },
}));

vi.mock("../../utils/sendEmail.js", () => ({
  default: vi.fn(),
}));

import { updateCompanyLogo } from "../../controllers/companyController.js";

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body) => {
    res.body = body;
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

function makeReq(overrides = {}) {
  return {
    params: { id: "company-1" },
    user: {
      role: ["Admin"],
      companyId: [{ toString: () => "company-1" }],
    },
    file: {
      path: "https://cdn.example.com/new-logo.webp",
      filename: "logos/new-logo",
    },
    ...overrides,
  };
}

function makeCompany(overrides = {}) {
  return {
    _id: "company-1",
    imageUrl: "https://cdn.example.com/old-logo.png",
    imagePublicId: "logos/old-logo",
    save: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("updateCompanyLogo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDestroy.mockResolvedValue({ result: "ok" });
  });

  it("returns 403 when the caller is not an admin", async () => {
    const req = makeReq({ user: { role: ["Employee"], companyId: ["company-1"] } });

    const { res, nextArgs } = await run(updateCompanyLogo, req, makeRes());

    expect(res.statusCode).toBe(403);
    expect(nextArgs[0].message).toMatch(/not authorized to update workspace logo/i);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("returns 403 when the admin does not belong to the workspace", async () => {
    const req = makeReq({
      user: {
        role: ["Admin"],
        companyId: [{ toString: () => "company-2" }],
      },
    });

    const { res, nextArgs } = await run(updateCompanyLogo, req, makeRes());

    expect(res.statusCode).toBe(403);
    expect(nextArgs[0].message).toMatch(/not authorized to update this workspace/i);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("returns 404 when the workspace does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    const { res, nextArgs } = await run(updateCompanyLogo, makeReq(), makeRes());

    expect(mockFindById).toHaveBeenCalledWith("company-1");
    expect(res.statusCode).toBe(404);
    expect(nextArgs[0].message).toMatch(/workspace not found/i);
  });

  it("returns 400 when no file upload is provided", async () => {
    mockFindById.mockResolvedValue(makeCompany());

    const { res, nextArgs } = await run(
      updateCompanyLogo,
      makeReq({ file: undefined }),
      makeRes(),
    );

    expect(res.statusCode).toBe(400);
    expect(nextArgs[0].message).toMatch(/no image file provided/i);
  });

  it("replaces the existing logo and persists the new asset metadata", async () => {
    const company = makeCompany();
    mockFindById.mockResolvedValue(company);

    const { res } = await run(updateCompanyLogo, makeReq(), makeRes());

    expect(mockDestroy).toHaveBeenCalledWith("logos/old-logo");
    expect(company.imageUrl).toBe("https://cdn.example.com/new-logo.webp");
    expect(company.imagePublicId).toBe("logos/new-logo");
    expect(company.save).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      imageUrl: "https://cdn.example.com/new-logo.webp",
      imagePublicId: "logos/new-logo",
    });
  });

  it("continues updating when old Cloudinary cleanup fails", async () => {
    const company = makeCompany();
    mockFindById.mockResolvedValue(company);
    mockDestroy.mockRejectedValue(new Error("cloudinary unavailable"));

    const { res } = await run(updateCompanyLogo, makeReq(), makeRes());

    expect(company.save).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
    expect(res.body.imageUrl).toBe("https://cdn.example.com/new-logo.webp");
  });
});
