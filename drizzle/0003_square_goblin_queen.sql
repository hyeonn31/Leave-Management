CREATE TABLE `teams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`approverId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `type` enum('leave_request_submitted','leave_approved','leave_rejected','leave_renewal','new_signup','team_leave_request','team_leave_approved','team_leave_rejected') NOT NULL;--> statement-breakpoint
ALTER TABLE `employees` ADD `teamId` int;