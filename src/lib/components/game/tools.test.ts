import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pinwheel } from '../../games/pinwheel';
import { tetroid } from '../../games/tetroid';
import { MemoryStorage } from '../../../test/memory-storage';
import { load } from '../../client/storage';
import { ToolState } from './tools.svelte';

beforeEach(() => vi.stubGlobal('localStorage', new MemoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('tools', () => {
	it("start with the game's default tool, then the one picked last", () => {
		const first = new ToolState(tetroid, false);
		expect(first.tool).toBe(tetroid.defaultTool(false));
		first.set('cross');
		expect(load('tool:tetroid', null)).toBe('cross');
		expect(new ToolState(tetroid, false).tool).toBe('cross');
	});

	it('switch by key, and ignore keys of no tool', () => {
		const tools = new ToolState(tetroid, false);
		expect(tools.key('3')).toBe(true);
		expect(tools.tool).toBe('cross');
		expect(tools.key('q')).toBe(false);
		expect(tools.tool).toBe('cross');
	});

	it('pick a colour with its key or swatch, together with the colour tool', () => {
		const tools = new ToolState(pinwheel, false);
		const colour = pinwheel.toolOptions!;
		expect(tools.option).toBe(colour.default);
		const other = colour.values.find((v) => v.value !== colour.default)!;
		expect(tools.key(other.key)).toBe(true);
		expect(tools).toMatchObject({ tool: colour.tool, option: other.value });
		tools.set('cross');
		tools.pick(colour.default);
		expect(tools).toMatchObject({ tool: colour.tool, option: colour.default });
	});

	it('go to the colour tool and back to the tool before', () => {
		const tools = new ToolState(pinwheel, false);
		tools.set('cross');
		tools.toggleColour();
		expect(tools.tool).toBe('color');
		tools.toggleColour();
		expect(tools.tool).toBe('cross');
		// A game without colours has nothing to switch to.
		const plain = new ToolState(tetroid, false);
		plain.set('cross');
		plain.toggleColour();
		plain.pick(1);
		expect(plain.tool).toBe('cross');
	});

	it("show the swatches on a phone's press of the colour tool, and toggle them on the next", () => {
		const phone = new ToolState(pinwheel, true);
		phone.set('cross');
		phone.press('color', false);
		expect(phone.swatches).toBe(true);
		phone.press('color', false);
		expect(phone.swatches).toBe(false);

		const wide = new ToolState(pinwheel, false);
		wide.set('cross');
		wide.press('color', true);
		expect(wide.swatches).toBe(false);
		wide.press('color', true);
		expect(wide.swatches).toBe(true);
		wide.press('cross', true);
		expect(wide).toMatchObject({ tool: 'cross', swatches: true });
	});
});
