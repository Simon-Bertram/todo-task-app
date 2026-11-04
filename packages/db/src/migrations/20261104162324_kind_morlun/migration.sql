ALTER TABLE `user` ADD `task_progress_control` text DEFAULT 'pie' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `progress_percent` integer DEFAULT 0 NOT NULL;