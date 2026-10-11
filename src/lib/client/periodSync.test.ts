import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Variant } from '../core/variants';
import { MemoryStorage } from '../../test/memory-storage';
import * as api from './api';
import { syncGamePeriods, syncPeriods } from './periodSync';
import { getStats, recordSolve } from './stats';

vi.mock('./api', () => ({
	currentPlayer: vi.fn(() => ({ id: 'p', name: 'P', token: 't' })),
	pullSave: vi.fn(async () => null),
	pushSave: vi.fn(async () => undefined)
}));

const daily = { key: 'daily', special: 'daily' } as Variant;
const weekly = { key: 'weekly', special: 'weekly' } as Variant;
const regular = { key: '6n' } as Variant;

const remote = (data: unknown) => ({ key: 'periods:tetroid:daily', data, updatedAt: 1 });

beforeEach(() => {
	vi.stubGlobal('localStorage', new MemoryStorage());
	vi.useFakeTimers({ now: Date.UTC(2026, 9, 7, 12), toFake: ['Date'] });
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('syncing the periods solved', () => {
	it("adds the server's periods here, and gives the server those only this device had", async () => {
		recordSolve('tetroid', 'daily', 1, 1000, '2026-10-07', 'daily');
		vi.mocked(api.pullSave).mockResolvedValueOnce(
			remote({ periods: ['2026-10-05', '2026-10-06'] })
		);
		await syncPeriods('tetroid', daily);
		expect(api.pullSave).toHaveBeenCalledWith('periods:tetroid:daily');
		expect(getStats('tetroid', 'daily').periods).toEqual([
			'2026-10-05',
			'2026-10-06',
			'2026-10-07'
		]);
		expect(api.pushSave).toHaveBeenCalledWith(
			'periods:tetroid:daily',
			{ periods: ['2026-10-05', '2026-10-06', '2026-10-07'] },
			Date.now()
		);
	});

	it('sends nothing when the server has them all', async () => {
		recordSolve('tetroid', 'daily', 1, 1000, '2026-10-07', 'daily');
		vi.mocked(api.pullSave).mockResolvedValueOnce(
			remote({ periods: ['2026-10-06', '2026-10-07'] })
		);
		await syncPeriods('tetroid', daily);
		expect(getStats('tetroid', 'daily').periods).toEqual(['2026-10-06', '2026-10-07']);
		expect(api.pushSave).not.toHaveBeenCalled();
	});

	it('reads anything the server holds without harm', async () => {
		recordSolve('tetroid', 'daily', 1, 1000, '2026-10-07', 'daily');
		for (const data of [null, 'x', { periods: 'x' }, { periods: [1, null, '2026-10-06'] }]) {
			vi.mocked(api.pullSave).mockResolvedValueOnce(data === null ? null : remote(data));
			await syncPeriods('tetroid', daily);
		}
		expect(getStats('tetroid', 'daily').periods).toEqual(['2026-10-06', '2026-10-07']);
	});

	it('does nothing without a player, nor for regular types', async () => {
		vi.mocked(api.currentPlayer).mockReturnValueOnce(null);
		await syncPeriods('tetroid', daily);
		await syncGamePeriods('tetroid', [regular]);
		expect(api.pullSave).not.toHaveBeenCalled();
	});

	it('syncs every special type of a game', async () => {
		await syncGamePeriods('tetroid', [regular, daily, weekly]);
		expect(
			vi
				.mocked(api.pullSave)
				.mock.calls.map((c) => c[0])
				.sort()
		).toEqual(['periods:tetroid:daily', 'periods:tetroid:weekly']);
	});
});
