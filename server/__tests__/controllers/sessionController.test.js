import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate, mockFindById, mockFind } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindById: vi.fn(),
  mockFind: vi.fn(),
}));

vi.mock('../../models/SessionLog.js', () => ({
  default: {
    create: mockCreate,
    findById: mockFindById,
    find: mockFind,
  },
}));

import {
  startSession,
  endSession,
  getAllSessions,
} from '../../controllers/sessionController.js';

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

describe('startSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a session for the authenticated user and returns the session id', async () => {
    mockCreate.mockResolvedValue({ _id: 'session-1' });

    const req = { user: { _id: 'user-1' } };
    const { res } = await run(startSession, req, makeRes());

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
    );
    expect(res.statusCode).toBe(201);
    expect(res._body).toEqual({ sessionId: 'session-1' });
  });
});

describe('endSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when sessionId is missing', async () => {
    const req = { body: {}, user: { _id: 'user-1' } };
    const { res, nextArgs } = await run(endSession, req, makeRes());

    expect(res.statusCode).toBe(400);
    expect(nextArgs[0]).toBeInstanceOf(Error);
    expect(nextArgs[0].message).toMatch(/session id is required/i);
  });

  it('returns 404 when session belongs to another user', async () => {
    mockFindById.mockResolvedValue({
      userId: { toString: () => 'another-user' },
    });

    const req = { body: { sessionId: 'session-1' }, user: { _id: 'user-1' } };
    const { res, nextArgs } = await run(endSession, req, makeRes());

    expect(res.statusCode).toBe(404);
    expect(nextArgs[0]).toBeInstanceOf(Error);
    expect(nextArgs[0].message).toMatch(/session not found/i);
  });

  it('sets logout time and rounded duration when session ends', async () => {
    const nowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-01-01T10:10:29.000Z').getTime());

    const session = {
      userId: { toString: () => 'user-1' },
      loginTime: new Date('2026-01-01T10:00:00.000Z'),
      save: vi.fn().mockResolvedValue(true),
    };

    Object.defineProperty(session, 'logoutTime', {
      configurable: true,
      enumerable: true,
      get() {
        return this._logoutTime;
      },
      set(value) {
        this._logoutTime = new Date(value);
      },
    });

    mockFindById.mockResolvedValue(session);

    const req = { body: { sessionId: 'session-1' }, user: { _id: 'user-1' } };
    const { res } = await run(endSession, req, makeRes());

    expect(session.save).toHaveBeenCalled();
    expect(session.durationMinutes).toBe(10);
    expect(res._body).toEqual({ message: 'Session ended', duration: 10 });
    nowSpy.mockRestore();
  });
});

describe('getAllSessions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-manager/admin roles', async () => {
    const req = { user: { role: ['Employee'] } };
    const { res, nextArgs } = await run(getAllSessions, req, makeRes());

    expect(res.statusCode).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
    expect(nextArgs[0].message).toMatch(/not authorized/i);
  });

  it('accepts a single string role and returns session logs', async () => {
    const logs = [{ _id: 'log-1' }, { _id: 'log-2' }];
    const limit = vi.fn().mockResolvedValue(logs);
    const sort = vi.fn().mockReturnValue({ limit });
    const populate = vi.fn().mockReturnValue({ sort });
    mockFind.mockReturnValue({ populate });

    const req = { user: { role: 'Manager' } };
    const { res } = await run(getAllSessions, req, makeRes());

    expect(mockFind).toHaveBeenCalledWith();
    expect(populate).toHaveBeenCalledWith(
      'userId',
      'firstName lastName email department',
    );
    expect(sort).toHaveBeenCalledWith({ loginTime: -1 });
    expect(limit).toHaveBeenCalledWith(100);
    expect(res._body).toEqual(logs);
  });
});
