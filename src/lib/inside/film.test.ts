import { describe, expect, it } from 'vitest';
import { FILM } from '../../test/film';
import { BEAT, Timeline } from './film';

describe('Timeline', () => {
	const timeline = new Timeline(FILM);

	it('lists the frames and where the chapters start', () => {
		expect(timeline.frames.map((f) => f.caption.key)).toEqual([
			'a0',
			'a1',
			'a2',
			'b0',
			'c0',
			'c1',
			'c2',
			'c3'
		]);
		expect(timeline.starts).toEqual([0, 3, 4]);
		expect(timeline.last).toBe(7);
		expect([0, 2, 3, 4, 7].map((i) => timeline.chapterOf(i))).toEqual([0, 0, 1, 2, 2]);
	});

	it('keeps a frame number within the film', () => {
		expect([-3, 2.4, 99].map((i) => timeline.clamp(i))).toEqual([0, 2, 7]);
	});

	it('holds a frame for its beats, shorter when faster', () => {
		expect(timeline.duration(0, 1)).toBe(2 * BEAT);
		expect(timeline.duration(1, 1)).toBe(BEAT);
		expect(timeline.duration(7, 2)).toBe(BEAT / 4);
	});

	it('goes back to the chapter start, or to the chapter before from its first frames', () => {
		expect(timeline.back(6)).toBe(4);
		// On the first two frames of a chapter, back goes one chapter further.
		expect(timeline.back(5)).toBe(3);
		expect(timeline.back(4)).toBe(3);
		expect(timeline.back(3)).toBe(0);
		expect(timeline.back(1)).toBe(0);
	});

	it('goes on to the next chapter, or to the end from the last', () => {
		expect(timeline.next(1)).toBe(3);
		expect(timeline.next(3)).toBe(4);
		expect(timeline.next(5)).toBe(7);
	});
});
