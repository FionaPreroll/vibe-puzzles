import { afterEach, describe, expect, it } from 'vitest';
import { answer, ask, confirmation } from './confirm.svelte';

const question = (title: string) => ({ title, text: 'Sure?', confirm: 'Yes' });

afterEach(() => {
	while (confirmation.queue.length) answer(false);
});

describe('confirmations', () => {
	it('shows a question until it is answered', async () => {
		const agreed = ask({ ...question('Delete'), danger: true });
		expect(confirmation.queue).toHaveLength(1);
		expect(confirmation.queue[0]).toMatchObject({ title: 'Delete', danger: true });
		answer(true);
		expect(await agreed).toBe(true);
		expect(confirmation.queue).toHaveLength(0);
	});

	it('answers questions one after another, in order', async () => {
		const first = ask(question('First'));
		const second = ask(question('Second'));
		expect(confirmation.queue.map((q) => q.title)).toEqual(['First', 'Second']);
		answer(false);
		expect(confirmation.queue[0].title).toBe('Second');
		answer(true);
		expect([await first, await second]).toEqual([false, true]);
	});

	it('ignores an answer without a question', () => {
		answer(true);
		expect(confirmation.queue).toHaveLength(0);
	});
});
