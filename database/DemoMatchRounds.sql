use [tammilanit-booking]
go

create table dbo.DemoMatchRounds
(
    id              nvarchar(255) default (CONVERT([nvarchar](255), newid())) collate SQL_Latin1_General_CP1_CI_AS not null
        primary key,
    matchId         nvarchar(255) collate SQL_Latin1_General_CP1_CI_AS                                                                                  not null
        constraint FK_DemoMatchRounds_DemoMatches
            references dbo.DemoMatches
            on delete cascade,
    roundNumber     int                                                                                                                                 not null,
    winner          nvarchar(10) collate SQL_Latin1_General_CP1_CI_AS                                                                                   not null,
    winReason       nvarchar(50) collate SQL_Latin1_General_CP1_CI_AS                                                                                   not null,
    ctScore         int                                                                                                                                 not null,
    tScore          int                                                                                                                                 not null,
    durationSeconds int,
    startTick       int,
    endTick         int,
    createdAt       datetime      default getdate()                                                                                                     not null,
    constraint UQ_DemoMatchRounds_MatchRound
        unique (matchId, roundNumber)
)
    go

create index IX_DemoMatchRounds_MatchId
    on dbo.DemoMatchRounds (matchId)
    go

create index IX_DemoMatchRounds_MatchRound
    on dbo.DemoMatchRounds (matchId, roundNumber)
    go

