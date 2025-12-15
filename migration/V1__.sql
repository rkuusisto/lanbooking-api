CREATE TABLE lansettings
(
    id                      int IDENTITY (1, 1) NOT NULL,
    total                   int  NOT NULL,
    startDate               date NOT NULL,
    endDate                 date NOT NULL,
    eventName               nvarchar(255)       NOT NULL,
    createdAt               datetime
        CONSTRAINT DF_LanSettings_createdAt DEFAULT GETDATE(),
    updatedAt               datetime
        CONSTRAINT DF_LanSettings_updatedAt DEFAULT GETDATE(),
    AttendancePerDayEnabled bit
        CONSTRAINT DF_LanSettings_AttendancePerDayEnabled DEFAULT 0,
    FoodEnabled             bit
        CONSTRAINT DF_LanSettings_FoodEnabled DEFAULT 1,
    CONSTRAINT PK__lansetti__3213E83F4EED8070 PRIMARY KEY (id)
)
    GO

CREATE TABLE events
(
    id                char(36)
        CONSTRAINT DF_events_id DEFAULT newid() NOT NULL,
    name              nvarchar(255)             NOT NULL,
    is_active         bit
        CONSTRAINT DF_events_is_active DEFAULT 0,
    registration_open bit
        CONSTRAINT DF_events_registration_open DEFAULT 0,
    event_start_date  datetime NOT NULL,
    event_end_date    datetime NOT NULL,
    countdown_date    datetime,
    background_image  nvarchar(500),
    layout_config     nvarchar(MAX),
    created_at        datetime
        CONSTRAINT DF_events_created_at DEFAULT getutcdate(),
    updated_at        datetime
        CONSTRAINT DF_events_updated_at DEFAULT getutcdate(),
    CONSTRAINT PK__events__3213E83FC21280F0 PRIMARY KEY (id)
)
    GO

CREATE TABLE tablegroups
(
    id          int IDENTITY (1, 1) NOT NULL,
    name        nvarchar(50)        NOT NULL,
    groupSize   int NOT NULL,
    groupType   int,
    startOffset int,
    rotate      bit,
    style       nvarchar(MAX)       NOT NULL,
    CONSTRAINT PK__TableGro__3213E83FEF0223CE PRIMARY KEY (id)
)
    GO

ALTER TABLE lanbooking
    ADD createdAt datetime
    GO

ALTER TABLE lanbooking
    ADD updatedAt datetime
    GO

ALTER TABLE lanregistration
    ADD createdAt datetime
    GO

ALTER TABLE lanregistration
    ADD feedback nvarchar(4000)
GO

ALTER TABLE lanregistration
    ADD nickname nvarchar(255)
GO

ALTER TABLE lanregistration
    ADD steamId nvarchar(48)
GO

CREATE
NONCLUSTERED INDEX IX_events_active ON events (is_active)
GO