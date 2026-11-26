import type { GameModule, Hint } from '../../core/types';
import { t } from '../../i18n/index.svelte';
import { BRIDGES_SETTINGS, type BridgesSettingKey } from './settings';
import Board from './Board.svelte';
import { bridgesHint, type SupportReason } from './hint';
import { bridgesLogic } from './logic';
import { graphOf, islandKey, linkKey, type BridgesPuzzle, type BridgesState } from './rules';

/** Why links the step rests on take fewer bridges, per reason, by how many they still take. */
const SUPPORT: Record<SupportReason, [string, string]> = {
	blocked: ['emptyBlocked', 'emptyBlocked'],
	full: ['emptyFull', 'singleFull'],
	capacity: ['singleCapacity', 'singleCapacity'],
	isolation: ['emptyIsolation', 'singleIsolation']
};

/** Bridges: a board and hints, 7×7 so far; larger boards come later. */
export const bridges: GameModule<BridgesPuzzle, BridgesState, BridgesSettingKey> = {
	...bridgesLogic,
	// "Bridges", in German "Brücken": the name follows the language.
	get name() {
		return t('games.bridges.name');
	},
	earlyAccess: true,
	icon: '⊶',
	tools: [
		{ id: 'bridge', label: 'Bridge', icon: '═', key: '1' },
		{ id: 'cross', label: 'Cross', icon: '✕', key: '2' }
	],
	defaultTool: () => 'bridge',
	settings: BRIDGES_SETTINGS,
	board: Board,
	changes: (_, from, to) =>
		to.links.flatMap((value, l) => (value !== from.links[l] ? [linkKey(l)] : [])),
	hint(puzzle, state): Hint | null {
		const hint = bridgesHint(puzzle, state);
		if (!hint) return null;
		const g = graphOf(puzzle);
		const key = (k: string) => `games.bridges.hints.${k}`;
		if (hint.kind === 'mistake') {
			return { kind: 'mistake', spotlight: hint.links.map(linkKey), text: [key('mistake')] };
		}
		if (hint.kind === 'stuck') {
			return { kind: 'stuck', spotlight: hint.links.map(linkKey), text: [key('stuck')] };
		}
		const spotlight = hint.links.map(linkKey);
		// The spotlight's links stand out on their own: the tint leaves them.
		const area = [
			...new Set([
				...hint.islands.map((i) => islandKey(g, i)),
				...hint.area.map(linkKey),
				...hint.support.flatMap((s) => [linkKey(s.link), ...s.islands.map((i) => islandKey(g, i))])
			])
		].filter((key) => !spotlight.includes(key));
		const support = [...new Set(hint.support.map((s) => key(SUPPORT[s.reason][s.most ? 1 : 0])))];
		const then = key(`then${hint.bridges}${hint.links.length > 1 ? 'Each' : ''}`);
		if (hint.technique === 'assumption') {
			// Suppose the link had fewer bridges, say what breaks, then ask for them.
			const breaks = `breaks${hint.breaks![0].toUpperCase()}${hint.breaks!.slice(1)}`;
			return {
				kind: 'step',
				spotlight,
				area,
				teaser: [key('assumeLook')],
				text: [key(hint.bridges > 1 ? 'assumeOne' : 'assumeNone'), key(breaks), then]
			};
		}
		const look = key(`${hint.technique}Look`);
		const reason = hint.technique === 'need' && hint.all ? 'needAll' : hint.technique;
		return {
			kind: 'step',
			spotlight,
			area,
			teaser: [look],
			text: [look, ...support, key(reason), then]
		};
	}
};
