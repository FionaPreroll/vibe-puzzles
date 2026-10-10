import type { CDPSession, Page } from '@playwright/test';

/**
 * Everything a long session can leak, beyond the JS heap: timers, animation frames, observers,
 * object URLs, workers and their unanswered jobs, listeners on window, document and media
 * queries, detached DOM nodes and browser storage.
 *
 * `trackResources` wraps the browser APIs before the app starts; `resources` reads the counts.
 */
export async function trackResources(page: Page) {
	await page.addInitScript(() => {
		const intervals = new Set<number>();
		const timeouts = new Set<number>();
		const frames = new Set<number>();
		const observers = new Set<object>();
		const urls = new Set<string>();
		const listeners = new Map<string, Set<unknown>>();
		let workers = 0;
		let jobs = 0;

		const w = window as unknown as Record<string, unknown>;
		const { setInterval, clearInterval, setTimeout, clearTimeout } = window;
		const { requestAnimationFrame, cancelAnimationFrame } = window;
		const clear = (id: number) => (intervals.delete(id), timeouts.delete(id));
		w.setInterval = (fn: TimerHandler, ms?: number, ...args: unknown[]) => {
			const id = setInterval(fn, ms, ...args);
			intervals.add(id);
			return id;
		};
		w.setTimeout = (fn: TimerHandler, ms?: number, ...args: unknown[]) => {
			const id: number = setTimeout(
				(...a: unknown[]) => {
					timeouts.delete(id);
					if (typeof fn === 'function') fn(...a);
				},
				ms,
				...args
			);
			timeouts.add(id);
			return id;
		};
		// Either clear function clears either kind of timer.
		w.clearInterval = (id: number) => (clear(id), clearInterval(id));
		w.clearTimeout = (id: number) => (clear(id), clearTimeout(id));
		w.requestAnimationFrame = (fn: FrameRequestCallback) => {
			const id = requestAnimationFrame((t) => (frames.delete(id), fn(t)));
			frames.add(id);
			return id;
		};
		w.cancelAnimationFrame = (id: number) => (frames.delete(id), cancelAnimationFrame(id));

		for (const name of ['ResizeObserver', 'MutationObserver', 'IntersectionObserver']) {
			const Base = w[name] as typeof ResizeObserver;
			w[name] = class extends Base {
				observe(...args: Parameters<ResizeObserver['observe']>) {
					observers.add(this);
					return super.observe(...args);
				}
				disconnect() {
					observers.delete(this);
					return super.disconnect();
				}
			};
		}

		const { createObjectURL, revokeObjectURL } = URL;
		URL.createObjectURL = (obj: Blob | MediaSource) => {
			const url = createObjectURL(obj);
			urls.add(url);
			return url;
		};
		URL.revokeObjectURL = (url: string) => (urls.delete(url), revokeObjectURL(url));

		const BaseWorker = Worker;
		w.Worker = class extends BaseWorker {
			constructor(...args: ConstructorParameters<typeof Worker>) {
				super(...args);
				workers++;
				super.addEventListener('message', () => jobs--);
			}
			postMessage(...args: [unknown, Transferable[]]) {
				jobs++;
				return super.postMessage(...args);
			}
			terminate() {
				workers--;
				return super.terminate();
			}
		};

		// Listeners on long-lived targets; ones on elements go away with their elements.
		const targetName = (t: EventTarget) =>
			t === window
				? 'window'
				: t === document
					? 'document'
					: t instanceof MediaQueryList
						? 'media'
						: null;
		const key = (t: EventTarget, type: string, opts?: boolean | EventListenerOptions) =>
			`${targetName(t)}:${type}${(typeof opts === 'boolean' ? opts : opts?.capture) ? ':capture' : ''}`;
		const { addEventListener, removeEventListener } = EventTarget.prototype;
		EventTarget.prototype.addEventListener = function (type, fn, opts) {
			if (fn && targetName(this)) {
				const k = key(this, type, opts);
				if (!listeners.has(k)) listeners.set(k, new Set());
				listeners.get(k)!.add(fn);
			}
			return addEventListener.call(this, type, fn, opts);
		};
		EventTarget.prototype.removeEventListener = function (type, fn, opts) {
			if (fn && targetName(this)) listeners.get(key(this, type, opts))?.delete(fn);
			return removeEventListener.call(this, type, fn, opts);
		};
		// MediaQueryList's legacy API, routed through the tracked one.
		MediaQueryList.prototype.addListener = function (fn) {
			if (fn) this.addEventListener('change', fn as EventListener);
		};
		MediaQueryList.prototype.removeListener = function (fn) {
			if (fn) this.removeEventListener('change', fn as EventListener);
		};

		w.__resources = () => ({
			intervals: intervals.size,
			timeouts: timeouts.size,
			frames: frames.size,
			observers: observers.size,
			objectURLs: urls.size,
			workers,
			jobs,
			listeners: Object.fromEntries(
				[...listeners].filter(([, s]) => s.size).map(([k, s]) => [k, s.size])
			) as Record<string, number>
		});
	});
}

export type Resources = Awaited<ReturnType<typeof resources>>;

/**
 * All counts after a full garbage collection. `detachedNodes` are DOM nodes still alive but no
 * longer in the document, the typical leak of a component that was removed but is still
 * referenced.
 */
export async function resources(page: Page, cdp: CDPSession) {
	await cdp.send('HeapProfiler.collectGarbage');
	const { metrics } = await cdp.send('Performance.getMetrics');
	const get = (name: string) => metrics.find((m) => m.name === name)?.value ?? 0;
	const inPage = await page.evaluate(async () => {
		let attached = 0;
		const walker = document.createTreeWalker(document, NodeFilter.SHOW_ALL);
		while (walker.nextNode()) attached++;
		const storage = Object.keys(localStorage).reduce(
			(n, k) => n + k.length + (localStorage.getItem(k)?.length ?? 0),
			0
		);
		const { usage = 0 } = await navigator.storage.estimate();
		const counts = (
			window as unknown as { __resources: () => Record<string, unknown> }
		).__resources();
		return { attached: attached + 1, storage, storageUsage: usage, ...counts };
	});
	const nodes = get('Nodes');
	return {
		heapMB: Math.round((get('JSHeapUsedSize') / 2 ** 20) * 10) / 10,
		nodes,
		detachedNodes: Math.max(0, nodes - inPage.attached),
		/** Documents alive, also ones no longer shown (an iframe, an SVG image). */
		documents: get('Documents'),
		jsListeners: get('JSEventListeners'),
		...(inPage as typeof inPage & {
			intervals: number;
			timeouts: number;
			frames: number;
			observers: number;
			objectURLs: number;
			workers: number;
			jobs: number;
			listeners: Record<string, number>;
		})
	};
}
