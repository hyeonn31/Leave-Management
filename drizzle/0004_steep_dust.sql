ALTER TABLE `leave_requests` ADD `teamApprovalStatus` enum('none','pending','approved','rejected') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD `teamApproverId` int;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD `teamApprovedAt` timestamp;