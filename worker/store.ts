/** Storage behind the API: Cloudflare D1 in production, in memory for tests. */

export interface PlayerRow {
	id: string;
	name: string;
}

export interface ScoreRow {
	playerId: string;
	game: string;
	variant: string;
	puzzleId: number;
	timeMs: number;
	playMs: number;
	competitive: boolean;
	createdAt: number;
}

export interface BoardRow {
	playerId: string;
	name: string;
	timeMs: number;
	playMs: number;
	puzzleId: number;
	createdAt: number;
}

/** A puzzle the server generated for one player; the competitive clock runs from `issuedAt`. */
export interface TicketRow {
	id: string;
	playerId: string;
	game: string;
	variant: string;
	puzzleId: number;
	puzzle: string;
	issuedAt: number;
	solvedAt: number | null;
}

/** Leaderboard scope: a variant overall, or one puzzle (special types). */
export interface Scope {
	game: string;
	variant: string;
	puzzleId: number | null;
}

export interface Store {
	createPlayer(id: string, name: string, tokenHash: string): Promise<void>;
	playerByToken(tokenHash: string): Promise<PlayerRow | null>;
	renamePlayer(id: string, name: string): Promise<void>;
	getSave(playerId: string, key: string): Promise<{ data: string; updatedAt: number } | null>;
	/** Stores the save at server time `storedAt` unless a newer one exists. Returns whether it was stored. */
	putSave(
		playerId: string,
		key: string,
		data: string,
		updatedAt: number,
		storedAt: number
	): Promise<boolean>;
	/**
	 * Keeps the `count` most recently stored saves of a player, and of those only as many as fit
	 * into `size` characters; deletes the rest and returns how many.
	 */
	trimSaves(playerId: string, count: number, size: number): Promise<number>;
	/** Deletes saves last stored before `storedBefore`; returns how many. */
	deleteSaves(storedBefore: number): Promise<number>;
	/** Returns the stored fingerprint, storing `fingerprint` first if none exists. */
	fingerprint(game: string, puzzleId: number, fingerprint: string): Promise<string>;
	/** Adds a score; false if the player already solved this puzzle. */
	addScore(score: ScoreRow): Promise<boolean>;
	/** Best competitive time per player, fastest first. */
	board(scope: Scope, limit: number): Promise<BoardRow[]>;
	/** Rank (1-based) and best row of a player, or null. */
	rank(scope: Scope, playerId: string): Promise<{ rank: number; row: BoardRow } | null>;
	players(scope: Scope): Promise<number>;
	createTicket(ticket: TicketRow): Promise<void>;
	getTicket(id: string): Promise<TicketRow | null>;
	/** Marks the ticket solved; false if it already was. */
	solveTicket(id: string, at: number): Promise<boolean>;
	/** IDs of the puzzles of a type that a player was issued or has solved. */
	playedPuzzles(playerId: string, game: string, variant: string): Promise<Set<number>>;
	/** Deletes tickets issued before `issuedBefore` or solved before `solvedBefore`; returns how many. */
	deleteTickets(issuedBefore: number, solvedBefore: number): Promise<number>;
}

export class MemoryStore implements Store {
	private readonly playerRows = new Map<string, PlayerRow & { tokenHash: string }>();
	private readonly saves = new Map<
		string,
		{ playerId: string; data: string; updatedAt: number; storedAt: number }
	>();
	private readonly prints = new Map<string, string>();
	private readonly scores: ScoreRow[] = [];
	private readonly tickets = new Map<string, TicketRow>();

	async createPlayer(id: string, name: string, tokenHash: string) {
		this.playerRows.set(id, { id, name, tokenHash });
	}

	async playerByToken(tokenHash: string) {
		for (const p of this.playerRows.values()) {
			if (p.tokenHash === tokenHash) return { id: p.id, name: p.name };
		}
		return null;
	}

	async renamePlayer(id: string, name: string) {
		const p = this.playerRows.get(id);
		if (p) p.name = name;
	}

	async getSave(playerId: string, key: string) {
		const row = this.saves.get(`${playerId}\n${key}`);
		return row ? { data: row.data, updatedAt: row.updatedAt } : null;
	}

	async putSave(playerId: string, key: string, data: string, updatedAt: number, storedAt: number) {
		const k = `${playerId}\n${key}`;
		const old = this.saves.get(k);
		if (old && old.updatedAt >= updatedAt) return false;
		this.saves.set(k, { playerId, data, updatedAt, storedAt });
		return true;
	}

	async trimSaves(playerId: string, count: number, size: number) {
		const mine = [...this.saves.entries()]
			.filter(([, s]) => s.playerId === playerId)
			.sort(([a, x], [b, y]) => y.storedAt - x.storedAt || Number(a > b) - Number(a < b));
		let total = 0;
		let deleted = 0;
		mine.forEach(([k, s], i) => {
			total += s.data.length;
			if (i < count && total <= size) return;
			this.saves.delete(k);
			deleted++;
		});
		return deleted;
	}

	async deleteSaves(storedBefore: number) {
		let deleted = 0;
		for (const [k, s] of [...this.saves.entries()]) {
			if (s.storedAt < storedBefore) {
				this.saves.delete(k);
				deleted++;
			}
		}
		return deleted;
	}

	async fingerprint(game: string, puzzleId: number, fingerprint: string) {
		const k = `${game}:${puzzleId}`;
		if (!this.prints.has(k)) this.prints.set(k, fingerprint);
		return this.prints.get(k)!;
	}

	async addScore(score: ScoreRow) {
		const dup = this.scores.some(
			(s) => s.playerId === score.playerId && s.game === score.game && s.puzzleId === score.puzzleId
		);
		if (!dup) this.scores.push(score);
		return !dup;
	}

	private best(scope: Scope): BoardRow[] {
		const best = new Map<string, ScoreRow>();
		for (const s of this.scores) {
			if (s.game !== scope.game || s.variant !== scope.variant || !s.competitive) continue;
			if (scope.puzzleId != null && s.puzzleId !== scope.puzzleId) continue;
			const cur = best.get(s.playerId);
			if (!cur || s.timeMs < cur.timeMs) best.set(s.playerId, s);
		}
		return [...best.values()]
			.sort((a, b) => a.timeMs - b.timeMs || a.createdAt - b.createdAt)
			.map((s) => ({
				playerId: s.playerId,
				name: this.playerRows.get(s.playerId)?.name ?? '?',
				timeMs: s.timeMs,
				playMs: s.playMs,
				puzzleId: s.puzzleId,
				createdAt: s.createdAt
			}));
	}

	async board(scope: Scope, limit: number) {
		return this.best(scope).slice(0, limit);
	}

	async rank(scope: Scope, playerId: string) {
		const rows = this.best(scope);
		const i = rows.findIndex((r) => r.playerId === playerId);
		return i < 0 ? null : { rank: i + 1, row: rows[i] };
	}

	async players(scope: Scope) {
		return this.best(scope).length;
	}

	async createTicket(ticket: TicketRow) {
		this.tickets.set(ticket.id, { ...ticket });
	}

	async getTicket(id: string) {
		const t = this.tickets.get(id);
		return t ? { ...t } : null;
	}

	async solveTicket(id: string, at: number) {
		const t = this.tickets.get(id);
		if (!t || t.solvedAt != null) return false;
		t.solvedAt = at;
		return true;
	}

	async playedPuzzles(playerId: string, game: string, variant: string) {
		const mine = (r: { playerId: string; game: string; variant: string }) =>
			r.playerId === playerId && r.game === game && r.variant === variant;
		return new Set(
			[...this.scores.filter(mine), ...[...this.tickets.values()].filter(mine)].map(
				(r) => r.puzzleId
			)
		);
	}

	async deleteTickets(issuedBefore: number, solvedBefore: number) {
		let deleted = 0;
		for (const t of [...this.tickets.values()]) {
			if (t.issuedAt < issuedBefore || (t.solvedAt != null && t.solvedAt < solvedBefore)) {
				this.tickets.delete(t.id);
				deleted++;
			}
		}
		return deleted;
	}
}

interface TicketDbRow {
	id: string;
	player_id: string;
	game: string;
	variant: string;
	puzzle_id: number;
	puzzle: string;
	issued_at: number;
	solved_at: number | null;
}

interface BestRow {
	player_id: string;
	name: string;
	time_ms: number;
	play_ms: number;
	puzzle_id: number;
	created_at: number;
}

const toBoardRow = (r: BestRow): BoardRow => ({
	playerId: r.player_id,
	name: r.name,
	timeMs: r.time_ms,
	playMs: r.play_ms,
	puzzleId: r.puzzle_id,
	createdAt: r.created_at
});

export class D1Store implements Store {
	constructor(private readonly db: D1Database) {}

	async createPlayer(id: string, name: string, tokenHash: string) {
		await this.db
			.prepare('INSERT INTO players (id, name, token_hash, created_at) VALUES (?, ?, ?, ?)')
			.bind(id, name, tokenHash, Date.now())
			.run();
	}

	async playerByToken(tokenHash: string) {
		return this.db
			.prepare('SELECT id, name FROM players WHERE token_hash = ?')
			.bind(tokenHash)
			.first<PlayerRow>();
	}

	async renamePlayer(id: string, name: string) {
		await this.db.prepare('UPDATE players SET name = ? WHERE id = ?').bind(name, id).run();
	}

	async getSave(playerId: string, key: string) {
		const row = await this.db
			.prepare('SELECT data, updated_at FROM saves WHERE player_id = ? AND key = ?')
			.bind(playerId, key)
			.first<{ data: string; updated_at: number }>();
		return row ? { data: row.data, updatedAt: row.updated_at } : null;
	}

	async putSave(playerId: string, key: string, data: string, updatedAt: number, storedAt: number) {
		const res = await this.db
			.prepare(
				`INSERT INTO saves (player_id, key, data, updated_at, stored_at, size) VALUES (?, ?, ?, ?, ?, ?)
				 ON CONFLICT (player_id, key) DO UPDATE SET data = excluded.data,
				   updated_at = excluded.updated_at, stored_at = excluded.stored_at, size = excluded.size
				 WHERE excluded.updated_at > saves.updated_at`
			)
			.bind(playerId, key, data, updatedAt, storedAt, data.length)
			.run();
		return res.meta.changes > 0;
	}

	async trimSaves(playerId: string, count: number, size: number) {
		const res = await this.db
			.prepare(
				`DELETE FROM saves WHERE player_id = ? AND key IN (
				   SELECT key FROM (
				     SELECT key, ROW_NUMBER() OVER newest AS n, SUM(size) OVER newest AS total
				     FROM saves WHERE player_id = ?
				     WINDOW newest AS (ORDER BY stored_at DESC, key)
				   ) WHERE n > ? OR total > ?
				 )`
			)
			.bind(playerId, playerId, count, size)
			.run();
		return res.meta.changes;
	}

	async deleteSaves(storedBefore: number) {
		const res = await this.db
			.prepare('DELETE FROM saves WHERE stored_at < ?')
			.bind(storedBefore)
			.run();
		return res.meta.changes;
	}

	async fingerprint(game: string, puzzleId: number, fingerprint: string) {
		await this.db
			.prepare('INSERT OR IGNORE INTO puzzles (game, puzzle_id, fingerprint) VALUES (?, ?, ?)')
			.bind(game, puzzleId, fingerprint)
			.run();
		const row = await this.db
			.prepare('SELECT fingerprint FROM puzzles WHERE game = ? AND puzzle_id = ?')
			.bind(game, puzzleId)
			.first<{ fingerprint: string }>();
		return row!.fingerprint;
	}

	async addScore(s: ScoreRow) {
		const res = await this.db
			.prepare(
				`INSERT OR IGNORE INTO scores
				 (player_id, game, variant, puzzle_id, time_ms, play_ms, competitive, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				s.playerId,
				s.game,
				s.variant,
				s.puzzleId,
				s.timeMs,
				s.playMs,
				s.competitive ? 1 : 0,
				s.createdAt
			)
			.run();
		return res.meta.changes > 0;
	}

	/** Best row per player within the scope, as a SQL fragment with its bindings. */
	private best(scope: Scope): { sql: string; args: unknown[] } {
		const puzzle = scope.puzzleId != null ? 'AND s.puzzle_id = ?' : '';
		const args: unknown[] = [scope.game, scope.variant];
		if (scope.puzzleId != null) args.push(scope.puzzleId);
		return {
			sql: `SELECT s.player_id, p.name, s.time_ms, s.play_ms, s.puzzle_id, s.created_at,
				ROW_NUMBER() OVER (PARTITION BY s.player_id ORDER BY s.time_ms, s.created_at) AS n
				FROM scores s JOIN players p ON p.id = s.player_id
				WHERE s.game = ? AND s.variant = ? AND s.competitive = 1 ${puzzle}`,
			args
		};
	}

	async board(scope: Scope, limit: number) {
		const { sql, args } = this.best(scope);
		const { results } = await this.db
			.prepare(`SELECT * FROM (${sql}) WHERE n = 1 ORDER BY time_ms, created_at LIMIT ?`)
			.bind(...args, limit)
			.all<BestRow>();
		return results.map(toBoardRow);
	}

	async rank(scope: Scope, playerId: string) {
		const { sql, args } = this.best(scope);
		const row = await this.db
			.prepare(
				`WITH best AS (SELECT * FROM (${sql}) WHERE n = 1)
				 SELECT b.*, (SELECT COUNT(*) FROM best o WHERE o.time_ms < b.time_ms
				   OR (o.time_ms = b.time_ms AND o.created_at < b.created_at)) + 1 AS rank
				 FROM best b WHERE b.player_id = ?`
			)
			.bind(...args, playerId)
			.first<BestRow & { rank: number }>();
		return row ? { rank: row.rank, row: toBoardRow(row) } : null;
	}

	async players(scope: Scope) {
		const { sql, args } = this.best(scope);
		const row = await this.db
			.prepare(`SELECT COUNT(*) AS c FROM (${sql}) WHERE n = 1`)
			.bind(...args)
			.first<{ c: number }>();
		return row?.c ?? 0;
	}

	async createTicket(t: TicketRow) {
		await this.db
			.prepare(
				`INSERT INTO tickets (id, player_id, game, variant, puzzle_id, puzzle, issued_at, solved_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
			)
			.bind(t.id, t.playerId, t.game, t.variant, t.puzzleId, t.puzzle, t.issuedAt)
			.run();
	}

	async getTicket(id: string) {
		const r = await this.db
			.prepare('SELECT * FROM tickets WHERE id = ?')
			.bind(id)
			.first<TicketDbRow>();
		return r
			? {
					id: r.id,
					playerId: r.player_id,
					game: r.game,
					variant: r.variant,
					puzzleId: r.puzzle_id,
					puzzle: r.puzzle,
					issuedAt: r.issued_at,
					solvedAt: r.solved_at
				}
			: null;
	}

	async solveTicket(id: string, at: number) {
		const res = await this.db
			.prepare('UPDATE tickets SET solved_at = ? WHERE id = ? AND solved_at IS NULL')
			.bind(at, id)
			.run();
		return res.meta.changes > 0;
	}

	async playedPuzzles(playerId: string, game: string, variant: string) {
		const { results } = await this.db
			.prepare(
				`SELECT puzzle_id FROM scores WHERE player_id = ? AND game = ? AND variant = ?
				 UNION SELECT puzzle_id FROM tickets WHERE player_id = ? AND game = ? AND variant = ?`
			)
			.bind(playerId, game, variant, playerId, game, variant)
			.all<{ puzzle_id: number }>();
		return new Set(results.map((r) => r.puzzle_id));
	}

	async deleteTickets(issuedBefore: number, solvedBefore: number) {
		const res = await this.db
			.prepare('DELETE FROM tickets WHERE issued_at < ? OR solved_at < ?')
			.bind(issuedBefore, solvedBefore)
			.run();
		return res.meta.changes;
	}
}
