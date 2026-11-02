CREATE TABLE `user_day_stats` (
	`completed_minutes` integer DEFAULT 0 NOT NULL,
	`is_protected` integer DEFAULT false NOT NULL,
	`local_date` text NOT NULL,
	`planned_minutes` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	CONSTRAINT `user_day_stats_pk` PRIMARY KEY(`user_id`, `local_date`),
	CONSTRAINT `fk_user_day_stats_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user_milestones` (
	`key` text NOT NULL,
	`unlocked_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	CONSTRAINT `user_milestones_pk` PRIMARY KEY(`user_id`, `key`),
	CONSTRAINT `fk_user_milestones_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `user` ADD `celebrations` text DEFAULT 'subtle' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `onboarding_completed_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `rhythm_best` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `rhythm_current` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `rhythm_opt_in` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `tasks_user_id_is_completed_completed_at_idx` ON `tasks` (`user_id`,`is_completed`,`completed_at`);