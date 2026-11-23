/**
 * Confirmations in the app's own dialog instead of the browser's `confirm()`, which blocks the
 * page, cannot be styled and looks different on every platform. `ConfirmDialog` in the layout
 * shows the first open question.
 */

export interface Question {
	title: string;
	text: string;
	/** Label of the button that agrees. */
	confirm: string;
	/** The action destroys something: the button is red and Cancel gets the focus. */
	danger?: boolean;
	/** Label of a second way to agree, shown between Cancel and `confirm` (see `choose`). */
	other?: string;
	/** The second way destroys something: its button is red. */
	otherDanger?: boolean;
}

/** The player's answer: the `confirm` button, the `other` one, or none (cancelled). */
export type Answer = 'confirm' | 'other' | null;

interface Open extends Question {
	resolve: (answer: Answer) => void;
}

/** Questions waiting for an answer, the one shown first. */
export const confirmation = $state<{ queue: Open[] }>({ queue: [] });

/** Ask the player; resolves to true once they agree, false when they cancel or close the dialog. */
export function ask(question: Question): Promise<boolean> {
	return choose({ ...question, other: undefined }).then((a) => a === 'confirm');
}

/** Ask the player to pick one of two ways (`confirm` and `other`), or to cancel. */
export function choose(question: Question): Promise<Answer> {
	return new Promise((resolve) => confirmation.queue.push({ ...question, resolve }));
}

/** Answer the question that is shown: true or `'confirm'` agrees, false or null cancels. */
export function answer(choice: boolean | Answer) {
	const a: Answer = choice === true ? 'confirm' : choice === false ? null : choice;
	confirmation.queue.shift()?.resolve(a);
}
