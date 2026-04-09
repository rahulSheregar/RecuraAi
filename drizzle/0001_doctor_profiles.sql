CREATE TABLE `doctor_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`expertise` text NOT NULL,
	`schedule_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
