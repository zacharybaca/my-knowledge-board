import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockFind, mockFindOneAndUpdate } = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
}));

vi.mock("../../models/Notification.js", () => ({
  default: { find: mockFind, findOneAndUpdate: mockFindOneAndUpdate },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  getUserNotifications,
  markNotificationRead,
} from "../../controllers/notificationController.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRes() {
  const res = { statusCode: 200 };
  res.status = vi.fn((code) => {
    res.statusCode = code;
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
    const origJson = res.json.bind(res);
    res.json = vi.fn((...args) => {
      origJson(...args);
      done();
    });
    const next = vi.fn((...args) => done(...args));
    controller(req, res, next);
  });
}

// ── getUserNotifications ──────────────────────────────────────────────────────

describe("getUserNotifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a list of notifications for the authenticated user", async () => {
    const notifications = [
      { _id: "n1", message: "Article approved", isRead: false },
      { _id: "n2", message: "Article rejected", isRead: true },
    ];
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(notifications),
    });

    const req = { user: { _id: "user-1" } };
    const { res } = await run(getUserNotifications, req, makeRes());

    expect(mockFind).toHaveBeenCalledWith({ recipientId: "user-1" });
    expect(res._body).toEqual(notifications);
  });

  it("returns an empty array when the user has no notifications", async () => {
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });

    const req = { user: { _id: "user-no-notifs" } };
    const { res } = await run(getUserNotifications, req, makeRes());

    expect(res._body).toEqual([]);
  });
});

// ── markNotificationRead ──────────────────────────────────────────────────────

describe("markNotificationRead", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the notification as read and returns the updated document", async () => {
    const updated = { _id: "n1", isRead: true, message: "Done" };
    mockFindOneAndUpdate.mockResolvedValue(updated);

    const req = { params: { id: "n1" }, user: { _id: "user-1" } };
    const { res } = await run(markNotificationRead, req, makeRes());

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "n1", recipientId: "user-1" },
      { isRead: true },
      { new: true },
    );
    expect(res._body).toEqual(updated);
  });

  it("returns 404 when the notification does not belong to the user", async () => {
    mockFindOneAndUpdate.mockResolvedValue(null);

    const req = { params: { id: "ghost" }, user: { _id: "user-1" } };
    const { res, nextArgs } = await run(markNotificationRead, req, makeRes());

    expect(res.statusCode).toBe(404);
    expect(nextArgs[0]).toBeInstanceOf(Error);
    expect(nextArgs[0].message).toMatch(/notification not found/i);
  });
});
