-- Migration: Add displayName column to DemoMatches table
-- Date: 2025-11-28
-- Description: Adds optional displayName field for user-friendly demo file names

ALTER TABLE [DemoMatches]
ADD [displayName] NVARCHAR(255) NULL;

GO

-- Optional: Create index if display names will be used for search/filter
-- CREATE INDEX IX_DemoMatches_DisplayName ON [DemoMatches]([displayName]);

