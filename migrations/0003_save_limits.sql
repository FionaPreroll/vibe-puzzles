-- When the server last stored each save (its own clock, unlike the client's updated_at) and how
-- many characters it holds: a player keeps a limited number and size of saves, and saves nobody
-- has written for a long time are deleted (see SAVE_LIMITS in worker/api.ts).
ALTER TABLE saves ADD COLUMN stored_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE saves ADD COLUMN size INTEGER NOT NULL DEFAULT 0;
UPDATE saves SET stored_at = updated_at, size = length(data);

CREATE INDEX saves_player_stored ON saves (player_id, stored_at);
CREATE INDEX saves_stored ON saves (stored_at);
