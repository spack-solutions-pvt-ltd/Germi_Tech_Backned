-- Allotments.year: INT -> crop year text "25-26".
-- The model already declares STRING, but the column was still int(11), so a
-- "25-26" from the form was silently saved as 25. Run once per database.

ALTER TABLE `Allotments` MODIFY `year` VARCHAR(10) NULL;

-- Convert existing numeric years: 25 -> "25-26", 2026 -> "26-27".
UPDATE `Allotments`
SET `year` = CONCAT(
  LPAD(MOD(CAST(`year` AS UNSIGNED), 100), 2, '0'), '-',
  LPAD(MOD(CAST(`year` AS UNSIGNED) + 1, 100), 2, '0')
)
WHERE `year` REGEXP '^[0-9]+$';
