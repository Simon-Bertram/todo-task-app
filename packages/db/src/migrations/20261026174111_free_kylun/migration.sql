CREATE TABLE `projects` (
	`color` text DEFAULT '#3b82f6' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text,
	CONSTRAINT `fk_projects_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`actual_minutes` integer DEFAULT 0 NOT NULL,
	`blocked_by_task_id` text,
	`calendar_event_id` text,
	`completed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`due_date` text,
	`due_time` text,
	`estimated_minutes` integer DEFAULT 30 NOT NULL,
	`id` text PRIMARY KEY,
	`is_completed` integer DEFAULT false NOT NULL,
	`is_important` integer DEFAULT 0 NOT NULL,
	`is_today` integer DEFAULT false NOT NULL,
	`is_urgent` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`project_id` text,
	`recurrence_rule` text,
	`snooze_count` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`title` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text,
	CONSTRAINT `fk_tasks_blocked_by_task_id_tasks_id_fk` FOREIGN KEY (`blocked_by_task_id`) REFERENCES `tasks`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_tasks_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_tasks_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `subtasks` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`is_completed` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	CONSTRAINT `fk_subtasks_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `user` ADD `daily_capacity_minutes` integer DEFAULT 300 NOT NULL;--> statement-breakpoint
CREATE INDEX `projects_user_id_sort_order_idx` ON `projects` (`user_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `tasks_user_id_due_date_is_completed_idx` ON `tasks` (`user_id`,`due_date`,`is_completed`);--> statement-breakpoint
CREATE INDEX `tasks_user_id_is_urgent_is_important_idx` ON `tasks` (`user_id`,`is_urgent`,`is_important`);--> statement-breakpoint
CREATE INDEX `tasks_user_id_is_today_sort_order_idx` ON `tasks` (`user_id`,`is_today`,`sort_order`);--> statement-breakpoint
CREATE INDEX `tasks_user_id_status_idx` ON `tasks` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `tasks_user_id_project_id_idx` ON `tasks` (`user_id`,`project_id`);--> statement-breakpoint
CREATE INDEX `subtasks_task_id_sort_order_idx` ON `subtasks` (`task_id`,`sort_order`);
