-- Players are anonymous: a display name and the hash of a secret token (the sync code).
CREATE TABLE players (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	created_at INTEGER NOT NULL
);

-- Saved games and settings, one row per player and slot (last write wins by updated_at).
CREATE TABLE saves (
	player_id TEXT NOT NULL REFERENCES players (id),
	key TEXT NOT NULL,
	data TEXT NOT NULL,
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (player_id, key)
);

-- First definition seen for a puzzle ID; later submissions must match it.
CREATE TABLE puzzles (
	game TEXT NOT NULL,
	puzzle_id INTEGER NOT NULL,
	fingerprint TEXT NOT NULL,
	PRIMARY KEY (game, puzzle_id)
);

-- One verified solve per player and puzzle.
CREATE TABLE scores (
	player_id TEXT NOT NULL REFERENCES players (id),
	game TEXT NOT NULL,
	variant TEXT NOT NULL,
	puzzle_id INTEGER NOT NULL,
	time_ms INTEGER NOT NULL,
	play_ms INTEGER NOT NULL,
	competitive INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (player_id, game, puzzle_id)
);

CREATE INDEX scores_board ON scores (game, variant, competitive, time_ms);
CREATE INDEX scores_puzzle ON scores (game, puzzle_id, competitive, time_ms);
