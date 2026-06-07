PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_daily_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user` text DEFAULT 'profile_1' NOT NULL,
	`supplement_id` integer NOT NULL,
	`date` text NOT NULL,
	`taken` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`supplement_id`) REFERENCES `supplements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_daily_logs`("id", "user", "supplement_id", "date", "taken", "notes", "created_at") SELECT "id", "user", "supplement_id", "date", "taken", "notes", "created_at" FROM `daily_logs`;--> statement-breakpoint
DROP TABLE `daily_logs`;--> statement-breakpoint
ALTER TABLE `__new_daily_logs` RENAME TO `daily_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;