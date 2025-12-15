CREATE TABLE [DemoMatches] (
    [id] NVARCHAR(255) PRIMARY KEY,
    [tournamentId] NVARCHAR(255) NOT NULL,
    [event] NVARCHAR(255) NOT NULL,
    [stage] NVARCHAR(255) NOT NULL,
    [fileName] NVARCHAR(255) NOT NULL,
    [fileSizeMB] FLOAT NOT NULL,
    [map] NVARCHAR(255) NOT NULL,
    [bestOf] INT NOT NULL,
    [playedAt] DATETIME NOT NULL,
    [teams] NVARCHAR(MAX) NOT NULL, -- JSON array of team objects
    [highlights] NVARCHAR(MAX), -- JSON array of highlight objects (optional)
    [durationMinutes] INT, -- Optional
    [rounds] INT, -- Optional
    [notes] NVARCHAR(MAX), -- Optional
    [displayName] NVARCHAR(255), -- Optional
    [createdAt] DATETIME DEFAULT GETDATE(),
    [updatedAt] DATETIME DEFAULT GETDATE()
);

-- Create index for tournament queries
CREATE INDEX IX_DemoMatches_TournamentId ON [DemoMatches]([tournamentId]);

-- Create index for playedAt for sorting
CREATE INDEX IX_DemoMatches_PlayedAt ON [DemoMatches]([playedAt] DESC);

