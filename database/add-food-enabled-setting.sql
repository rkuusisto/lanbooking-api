-- Add foodEnabled column to LanSettings table
ALTER TABLE [LanSettings]
ADD [FoodEnabled] BIT DEFAULT 1;

-- Set default value for existing records (default to enabled for backward compatibility)
UPDATE [LanSettings]
SET [FoodEnabled] = 1
WHERE [FoodEnabled] IS NULL;


