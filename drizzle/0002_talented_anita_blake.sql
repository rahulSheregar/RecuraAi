CREATE TABLE `email_template` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
