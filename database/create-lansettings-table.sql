CREATE TABLE [LanSettings] (
    [id] INT IDENTITY(1,1) PRIMARY KEY,
    [total] INT NOT NULL,
    [startDate] DATE NOT NULL,
    [endDate] DATE NOT NULL,
    [eventName] NVARCHAR(255) NOT NULL,
    [createdAt] DATETIME DEFAULT GETDATE(),
    [updatedAt] DATETIME DEFAULT GETDATE()
);

-- Insert default settings
INSERT INTO [LanSettings] (total, startDate, endDate, eventName) 
VALUES (67, '2026-01-22', '2026-01-25', 'Tammilanit 2026');
