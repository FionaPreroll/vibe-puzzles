import { cellPlace, direction, listOf, sentences, withStates } from '../../client/speech';
import { t } from '../../i18n/index.svelte';
import {
	bridgesOf,
	CROSS,
	graphOf,
	type BridgesAnalysis,
	type BridgesPuzzle,
	type BridgesState
} from './rules';

/** What the board shows of the rules: errors in red, islands with all their bridges in grey. */
export interface BridgesShown {
	errors: boolean;
	dimSatisfied: boolean;
}

const SIDES = ['up', 'right', 'down', 'left'] as const;

/**
 * What a screen reader says about `cell`: an island with its number, its bridges by side and the
 * sides crossed out, e.g. "Row 2, column 3: island 4 (complete). Bridges: 2 right, 2 down"; or the
 * water and the bridges over it, e.g. "Row 2, column 4: a double bridge across".
 */
export function sayCell(
	p: BridgesPuzzle,
	s: BridgesState,
	a: BridgesAnalysis,
	cell: number,
	shown: BridgesShown
): string {
	const g = graphOf(p);
	const place = cellPlace(Math.floor(cell / p.width), cell % p.width);
	const i = g.islandAt[cell];
	if (i < 0) {
		const over = (['across', 'down'] as const).flatMap((way) => {
			const link = (way === 'across' ? g.acrossAt : g.downAt)[cell];
			if (link < 0 || !s.links[link]) return [];
			const value = s.links[link];
			const kind = value === CROSS ? 'none' : value === 2 ? 'double' : 'single';
			return [t(`games.bridges.speech.${kind}`, { way: t(`games.bridges.speech.${way}`) })];
		});
		return `${place}: ${over.length ? over.join(', ') : t('games.bridges.speech.water')}`;
	}
	const error = shown.errors && a.error[i];
	const island = withStates(t('games.bridges.speech.island', { clue: g.clue[i] }), [
		error && t('speech.error'),
		!error && shown.dimSatisfied && a.count[i] === g.clue[i] && t('speech.complete')
	]);
	const sides = (pick: (value: number) => string | null) =>
		SIDES.flatMap((dir, k) => {
			const link = g.sides[i * 4 + k];
			const said = link < 0 ? null : pick(s.links[link]);
			return said === null ? [] : [`${said} ${direction(dir)}`.trim()];
		});
	return sentences([
		`${place}: ${island}`,
		listOf(
			'games.bridges.speech.bridges',
			sides((v) => (bridgesOf(v) ? String(v) : null))
		),
		listOf(
			'games.bridges.speech.crosses',
			sides((v) => (v === CROSS ? '' : null))
		)
	]);
}
