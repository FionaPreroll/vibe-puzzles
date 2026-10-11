import { loadTool, saveTool } from '../../client/settings.svelte';
import type { GameModule } from '../../core/types';

type ToolGame = Pick<GameModule, 'id' | 'tools' | 'toolOptions' | 'defaultTool'>;

/**
 * The tool the player draws with, and for a game with colours (`toolOptions`) the colour and
 * whether its swatches are shown. The tool picked last is remembered per game.
 */
export class ToolState {
	tool = $state('');
	/** The tool before the last switch: `]` goes back to it from the colour tool. */
	previous = $state('');
	/** The game-specific option of `toolOptions.tool`, e.g. the colour. */
	option = $state(0);
	/** The colour swatches are shown. */
	swatches = $state(false);

	constructor(
		private readonly game: ToolGame,
		touch: boolean
	) {
		const fallback = game.defaultTool(touch);
		this.tool = loadTool(game.id, fallback);
		this.previous = fallback;
		this.option = game.toolOptions?.default ?? 0;
	}

	set = (id: string) => {
		if (id !== this.tool) this.previous = this.tool;
		this.tool = id;
		saveTool(this.game.id, id);
	};

	/**
	 * A tool button was pressed. The colour tool's button shows the swatches on phones, and on a
	 * second press shows or hides them anywhere.
	 */
	press(id: string, wide: boolean) {
		if (this.game.toolOptions?.tool === id) {
			if (this.tool === id) this.swatches = !this.swatches;
			else if (!wide) this.swatches = true;
		}
		this.set(id);
	}

	/** Pick a colour: it comes with its tool. */
	pick(option: number) {
		if (!this.game.toolOptions) return;
		this.option = option;
		this.set(this.game.toolOptions.tool);
	}

	/** Switch to the colour tool, or from it back to the tool before. */
	toggleColour() {
		const colour = this.game.toolOptions?.tool;
		if (colour) this.set(this.tool === colour ? this.previous : colour);
	}

	/** A tool's or a colour's key; true if it was one. */
	key(key: string): boolean {
		const tool = this.game.tools.find((x) => x.key === key);
		if (tool) {
			this.set(tool.id);
			return true;
		}
		const option = this.game.toolOptions?.values.find((x) => x.key === key);
		if (option) this.pick(option.value);
		return !!option;
	}
}
