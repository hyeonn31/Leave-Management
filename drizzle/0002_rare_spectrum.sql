DROP INDEX `idx_leave_balances_user_year` ON `leave_balances`;--> statement-breakpoint
ALTER TABLE `leave_balances` ADD CONSTRAINT `idx_leave_balances_user_year` UNIQUE(`userId`,`fiscalYear`);