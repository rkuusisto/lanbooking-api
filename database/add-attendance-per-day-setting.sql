-- Add attendancePerDayEnabled column to LanSettings table
ALTER TABLE [LanSettings]
ADD [AttendancePerDayEnabled] BIT DEFAULT 0;

-- Set default value for existing records
UPDATE [LanSettings]
SET [AttendancePerDayEnabled] = 0
WHERE [AttendancePerDayEnabled] IS NULL;

