CREATE TABLE `annotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`image_id` int NOT NULL,
	`category_id` int NOT NULL,
	`x` int NOT NULL,
	`y` int NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `annotations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(7) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_name_unique_idx` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(255) NOT NULL,
	`storage_key` varchar(512) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`size_bytes` int NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`status` enum('pending','annotated','reviewed') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `images_id` PRIMARY KEY(`id`),
	CONSTRAINT `images_storage_key_unique_idx` UNIQUE(`storage_key`)
);
--> statement-breakpoint
ALTER TABLE `annotations` ADD CONSTRAINT `annotations_image_id_images_id_fk` FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `annotations` ADD CONSTRAINT `annotations_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `annotations_image_id_idx` ON `annotations` (`image_id`);--> statement-breakpoint
CREATE INDEX `annotations_category_id_idx` ON `annotations` (`category_id`);--> statement-breakpoint
CREATE INDEX `images_status_idx` ON `images` (`status`);--> statement-breakpoint
CREATE INDEX `images_created_at_idx` ON `images` (`created_at`);