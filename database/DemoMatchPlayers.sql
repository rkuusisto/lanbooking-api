use [tammilanit-booking]
go

create table dbo.DemoMatchPlayers
(
    id                 nvarchar(255) default CONVERT([nvarchar](255), newid()) collate SQL_Latin1_General_CP1_CI_AS not null
        primary key,
    matchId            nvarchar(255) collate SQL_Latin1_General_CP1_CI_AS                                           not null
        constraint FK_DemoMatchPlayers_DemoMatches
            references dbo.DemoMatches
            on delete cascade,
    steamId            nvarchar(255) collate SQL_Latin1_General_CP1_CI_AS                                           not null,
    playerName         nvarchar(255) collate SQL_Latin1_General_CP1_CI_AS                                           not null,
    team               nvarchar(10) collate SQL_Latin1_General_CP1_CI_AS                                            not null,
    kills              int           default 0                                                                      not null,
    deaths             int           default 0                                                                      not null,
    assists            int           default 0                                                                      not null,
    adr                float         default 0                                                                      not null,
    headshotPercentage float         default 0                                                                      not null,
    firstKills         int           default 0                                                                      not null,
    firstDeaths        int           default 0                                                                      not null,
    tradeKills         int           default 0                                                                      not null,
    clutchesWon        int           default 0                                                                      not null,
    clutchesLost       int           default 0                                                                      not null,
    utilityDamage      float         default 0                                                                      not null,
    flashAssists       int           default 0                                                                      not null,
    createdAt          datetime      default getdate()                                                              not null,
    updatedAt          datetime      default getdate()                                                              not null,
    constraint UQ_DemoMatchPlayers_MatchSteam
        unique (matchId, steamId)
)
    go

create index IX_DemoMatchPlayers_MatchId
    on dbo.DemoMatchPlayers (matchId)
    go

create index IX_DemoMatchPlayers_SteamId
    on dbo.DemoMatchPlayers (steamId)
    go

