-- Links loading requests to the allotment bag stock (BagsBalances).
-- On approval each loading row's noOfBags is deducted (usedBags) from its
-- allotment's balance, the row stores which balance (bagsBalanceId) and the
-- request stores when (bagsDeductedAt) so it can never happen twice.
-- Run once per database.

ALTER TABLE `LoadingRequestEntries`
  ADD COLUMN `bagsBalanceId` INT NULL,
  ADD CONSTRAINT `loading_entries_bags_balance_fk`
    FOREIGN KEY (`bagsBalanceId`) REFERENCES `BagsBalances` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE `LoadingRequests`
  ADD COLUMN `bagsDeductedAt` DATETIME NULL;
