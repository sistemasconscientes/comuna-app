CREATE TABLE `daily_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplement_id` integer NOT NULL,
	`date` text NOT NULL,
	`taken` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`supplement_id`) REFERENCES `supplements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `phases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`notion_page_id` text
);
--> statement-breakpoint
CREATE TABLE `stock` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplement_id` integer NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`unit` text NOT NULL,
	`last_updated` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`supplement_id`) REFERENCES `supplements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_supplement_id_unique` ON `stock` (`supplement_id`);--> statement-breakpoint
CREATE TABLE `supplements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`dose` text NOT NULL,
	`unit` text NOT NULL,
	`phases` text DEFAULT '[]' NOT NULL,
	`notion_id` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT '' NOT NULL
);
