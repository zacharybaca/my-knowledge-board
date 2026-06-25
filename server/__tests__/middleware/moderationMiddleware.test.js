import { describe, it, expect, vi, beforeEach } from "vitest";
import { moderateContent } from "../../middleware/moderationMiddleware.js";

const makeReq = (body = {}) => ({ body });

const makeRes = () => {
  const res = { statusCode: 200 };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  return res;
};

describe("moderateContent middleware", () => {
  let res, next;

  beforeEach(() => {
    res = makeRes();
    next = vi.fn();
  });

  // ── Happy paths ──────────────────────────────────────────────────────────

  it("calls next() with no error for clean title and body", async () => {
    await moderateContent(
      makeReq({ title: "Onboarding Best Practices", body: "Welcome." }),
      res,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    // next called without an error argument
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it("calls next() when the request body has no text fields", async () => {
    await moderateContent(makeReq({}), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  // ── Base profanity ────────────────────────────────────────────────────────

  it("rejects content containing base-dictionary profanity via body field", async () => {
    await moderateContent(makeReq({ body: "This is a shit show." }), res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  // ── Custom word list ─────────────────────────────────────────────────────

  it("rejects content containing custom word 'idiot' in comment field", async () => {
    await moderateContent(
      makeReq({ comment: "You are such an idiot." }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("rejects content containing custom word 'fraud' in title field", async () => {
    await moderateContent(
      makeReq({ title: "Our fraud process guide." }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("rejects content containing custom word 'charlatan' in text field", async () => {
    await moderateContent(
      makeReq({ text: "He is a charlatan." }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  // ── Field coverage ───────────────────────────────────────────────────────

  it("scans the content field (knowledge-base articles)", async () => {
    await moderateContent(
      makeReq({ content: "This creep should not be trusted." }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
