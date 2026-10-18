import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BEAT, Timeline } from './film';
import { FILM } from '../../test/film';
import { FilmPlayer } from './player.svelte';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup() {
	const player = new FilmPlayer();
	player.load(new Timeline(FILM));
	return player;
}

describe('FilmPlayer', () => {
	it('does nothing without a film', () => {
		const player = new FilmPlayer();
		player.play();
		player.seek(3);
		player.chapterBack();
		player.chapterNext();
		expect(player.playing).toBe(false);
		expect(player.frame).toBeNull();
		expect(player.chapter).toBe(0);
		expect(player.atEnd).toBe(false);
	});

	it('plays frame after frame, each for its hold, and stops at the end', () => {
		const player = setup();
		expect(player.frame?.caption.key).toBe('a0');
		player.play();
		vi.advanceTimersByTime(2 * BEAT - 1);
		expect(player.index).toBe(0);
		vi.advanceTimersByTime(1);
		expect(player.index).toBe(1);
		vi.advanceTimersByTime(10 * BEAT);
		expect(player.index).toBe(7);
		expect(player.atEnd).toBe(true);
		expect(player.playing).toBe(false);
		// Played to the end: play starts over.
		player.toggle();
		expect(player.index).toBe(0);
		expect(player.playing).toBe(true);
		player.toggle();
		vi.advanceTimersByTime(10 * BEAT);
		expect(player.index).toBe(0);
	});

	it('plays faster or slower', () => {
		const player = setup();
		player.seek(1);
		player.setSpeed(4);
		player.play();
		vi.advanceTimersByTime(BEAT / 4);
		expect(player.index).toBe(2);
		player.setSpeed(0.5);
		vi.advanceTimersByTime(BEAT);
		expect(player.index).toBe(2);
		vi.advanceTimersByTime(BEAT);
		expect(player.index).toBe(3);
	});

	it('seeks while playing or paused, and steps paused', () => {
		const player = setup();
		player.play();
		player.seek(4);
		expect(player.chapter).toBe(2);
		vi.advanceTimersByTime(BEAT);
		expect(player.index).toBe(5);
		player.step(-1);
		expect(player.playing).toBe(false);
		expect(player.index).toBe(4);
		player.step(-10);
		expect(player.index).toBe(0);
	});

	it('jumps between chapters', () => {
		const player = setup();
		player.chapterNext();
		expect(player.index).toBe(3);
		player.chapterNext();
		player.chapterNext();
		expect(player.index).toBe(7);
		player.chapterBack();
		expect(player.index).toBe(4);
		player.chapterBack();
		expect(player.index).toBe(3);
	});

	it('starts a new film paused on its first frame, and stops when the page goes', () => {
		const player = setup();
		player.play();
		player.load(new Timeline(FILM));
		expect([player.index, player.playing]).toEqual([0, false]);
		player.play();
		player.dispose();
		vi.advanceTimersByTime(10 * BEAT);
		expect(player.index).toBe(0);
	});
});
