-- Active / Inactive status for labour groups and task types (used by the
-- ?status= filter on their list APIs). Existing rows become Active.
-- Run once per database.

ALTER TABLE `LaborGroups`
  ADD COLUMN `status` ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active';

ALTER TABLE `TaskTypes`
  ADD COLUMN `status` ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active';
