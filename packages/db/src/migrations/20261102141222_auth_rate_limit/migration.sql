CREATE TABLE `rate_limit` (
	`count` integer NOT NULL,
	`id` text PRIMARY KEY,
	`key` text NOT NULL UNIQUE,
	`last_request` integer NOT NULL
);
