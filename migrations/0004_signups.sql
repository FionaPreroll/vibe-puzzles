-- Registrations per client address and day, to limit how many players one address can create in
-- a day (SIGNUPS_PER_DAY in worker/api.ts). The address is only kept as a hash with the day, and
-- the daily cron deletes the counts of earlier days.
CREATE TABLE signups (
	day TEXT NOT NULL,
	client TEXT NOT NULL,
	count INTEGER NOT NULL,
	PRIMARY KEY (day, client)
);
