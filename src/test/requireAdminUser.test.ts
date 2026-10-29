import { beforeEach, expect, it, vi } from 'vitest';
const role = vi.hoisted(() => vi.fn());
vi.mock('../../vps/server/src/lib/localUserData.js', () => ({ hasLocalUserRole: role }));
import { requireAdminUser } from '../../vps/server/src/middleware/requireAdminUser';

beforeEach(() => role.mockReset());

it.each([
  [undefined, false, 401],
  [{ id: 'regular-user' }, false, 403],
  [{ id: 'admin' }, true, 0],
])('requires an authenticated administrator (%j)', async (authUser, isAdmin, status) => {
  role.mockResolvedValue(isAdmin);
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  await requireAdminUser({ authUser } as never, response as never, next);
  if (status) {
    expect(response.status).toHaveBeenCalledWith(status);
    expect(next).not.toHaveBeenCalled();
  } else {
    expect(role).toHaveBeenCalledWith('admin', 'admin');
    expect(next).toHaveBeenCalledWith();
  }
});
