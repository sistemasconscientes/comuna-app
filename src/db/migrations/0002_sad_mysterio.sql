CREATE TABLE `cycle_states` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user` text NOT NULL,
	`last_period_start` text,
	`updated_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cycle_states_user_unique` ON `cycle_states` (`user`);