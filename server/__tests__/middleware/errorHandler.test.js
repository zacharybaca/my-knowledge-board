import { describe, it, expect, vi } from "vitest";
import { errorHandler } from "../../middleware/errorHandler.js";

const makeRes = (statusCode = 200) => {
  const res = { statusCode };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe("errorHandler", () => {
  it("uses the existing non-200 status code", () => {
    const res = makeRes(404);
    const err = new Error("Not found");

    errorHandler(err, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Not found" }),
    );
  });

  it("defaults to 500 when status is still 200", () => {
    const res = makeRes(200);
    const err = new Error("Something broke");

    errorHandler(err, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("omits stack trace in production", () => {
    process.env.NODE_ENV = "production";
    const res = makeRes(500);
    const err = new Error("Prod error");
    err.stack = "big scary stack";

    errorHandler(err, {}, res, vi.fn());

    const body = res.json.mock.calls[0][0];
    expect(body.stack).toBeNull();

    process.env.NODE_ENV = "test";
  });

  it("includes stack trace outside production", () => {
    process.env.NODE_ENV = "development";
    const res = makeRes(500);
    const err = new Error("Dev error");
    err.stack = "useful stack trace";

    errorHandler(err, {}, res, vi.fn());

    const body = res.json.mock.calls[0][0];
    expect(body.stack).toBe("useful stack trace");

    process.env.NODE_ENV = "test";
  });
});
