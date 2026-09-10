use [tammilanit-booking]
go

create table dbo.DemoRoundEvents
(
    id              nvarchar(255) default (CONVERT([nvarchar](255), newid())) collate SQL_Latin1_General_CP1_CI_AS not null
        primary key,
    matchId         nvarchar(255) collate SQL_Latin1_General_CP1_CI_AS                                                                                  not null
        constraint FK_DemoRoundEvents_DemoMatches
            references dbo.DemoMatches
            on delete cascade,
    roundId         nvarchar(255) collate SQL_Latin1_General_CP1_CI_AS                                                                                  not null
        constraint FK_DemoRoundEvents_DemoMatchRounds
            references dbo.DemoMatchRounds,
    roundNumber     int                                                                                                                                 not null,
    eventType       nvarchar(50) collate SQL_Latin1_General_CP1_CI_AS                                                                                   not null,
    tick            int                                                                                                                                 not null,
    attackerSteamId nvarchar(255) collate SQL_Latin1_General_CP1_CI_AS,
    victimSteamId   nvarchar(255) collate SQL_Latin1_General_CP1_CI_AS,
    assisterSteamId nvarchar(255) collate SQL_Latin1_General_CP1_CI_AS,
    weapon          nvarchar(50) collate SQL_Latin1_General_CP1_CI_AS,
    isHeadshot      bit           default 0                                                                                                             not null,
    isTradeKill     bit           default 0                                                                                                             not null,
    positionX       float,
    positionY       float,
    positionZ       float,
    eventData       nvarchar(max) collate SQL_Latin1_General_CP1_CI_AS,
    createdAt       datetime      default getdate()                                                                                                     not null
)
    go

create index IX_DemoRoundEvents_MatchId
    on dbo.DemoRoundEvents (matchId)
    go

create index IX_DemoRoundEvents_RoundId
    on dbo.DemoRoundEvents (roundId)
    go

create index IX_DemoRoundEvents_RoundNumber
    on dbo.DemoRoundEvents (matchId, roundNumber)
    go

create index IX_DemoRoundEvents_EventType
    on dbo.DemoRoundEvents (eventType)
    go

