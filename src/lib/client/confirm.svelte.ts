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
}

interface Open extends Question {
	resolve: (ok: boolean) => void;
}

/** Questions waiting for an answer, the one shown first. */
export const confirmation = $state<{ queue: Open[] }>({ queue: [] });

/** Ask the player; resolves to true once they agree, false when they cancel or close the dialog. */
export function ask(question: Question): Promise<boolean> {
	return new Promise((resolve) => confirmation.queue.push({ ...question, resolve }));
}

/** Answer the question that is shown. */
export function answer(ok: boolean) {
	confirmation.queue.shift()?.resolve(ok);
}
