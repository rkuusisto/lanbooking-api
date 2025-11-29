# REST API Schema for Azure SQL Integration

This document defines the REST API interface that the main API application implements. The demo parser worker calls these endpoints to store parsed data in Azure SQL.

## Base URL

The API base URL should be configurable via environment variable `AZURE_SQL_API_URL`.

All endpoints are prefixed with `/api/v1`.

## Authentication

All write endpoints require OIDC (OpenID Connect) authentication via Keycloak. The worker should authenticate using:
- **Service accounts**: Client credentials flow
- **User tokens**: Standard authorization code flow

Send the access token in the `Authorization` header:

```
Authorization: Bearer <ACCESS_TOKEN>
```

The token will be validated against your Keycloak realm and must have the required role (if configured via `KEYCLOAK_REQUIRED_ROLE`).

---

## Endpoints

### 1. Create/Update Demo Match (Upsert)

**POST** `/api/v1/demo-matches`

Creates a new demo match record or updates an existing one based on the `id` field.

**Request Body:**

```json
{
  "id": "string (required, use UUID format)",
  "tournamentId": "string (required)",
  "event": "string (required)",
  "stage": "string (required)",
  "fileName": "string (required)",
  "fileSizeMB": "number (required)",
  "map": "string (required)",
  "bestOf": "number (required)",
  "playedAt": "ISO 8601 datetime string (required)",
  "teams": "array of team objects (required)",
  "highlights": "array of highlight objects (optional)",
  "durationMinutes": "number (optional)",
  "rounds": "number (optional)",
  "notes": "string (optional)",
  "displayName": "string (optional)",
  "parseStatus": "string (optional, one of: pending, processing, completed, failed, default: pending)",
  "parseError": "string (optional, error message if parsing failed)"
}
```

**Response:**

```json
{
  "id": "string",
  "tournamentId": "string",
  "event": "string",
  "stage": "string",
  "fileName": "string",
  "fileSizeMB": "number",
  "map": "string",
  "bestOf": "number",
  "playedAt": "ISO 8601 datetime string",
  "teams": "array",
  "highlights": "array (if provided)",
  "durationMinutes": "number (if provided)",
  "rounds": "number (if provided)",
  "notes": "string (if provided)",
  "displayName": "string (if provided)",
  "parseStatus": "string",
  "parseError": "string (if provided)"
}
```

**Status Codes:**

- `200` - Success (created or updated)
- `400` - Bad request (validation error)
- `401` - Unauthorized
- `500` - Server error

---

### 2. Upsert Match Players

**POST** `/api/v1/demo-matches/:matchId/players`

Creates or updates player statistics for a match. Can accept a single player or an array of players. Uses `(matchId, steamId)` as unique constraint for upsert logic.

**Request Body (single player):**

```json
{
  "steamId": "string (required)",
  "playerName": "string (required)",
  "team": "string (required, 'CT' or 'T')",
  "kills": "number (default: 0)",
  "deaths": "number (default: 0)",
  "assists": "number (default: 0)",
  "adr": "number (default: 0)",
  "headshotPercentage": "number (default: 0)",
  "firstKills": "number (default: 0)",
  "firstDeaths": "number (default: 0)",
  "tradeKills": "number (default: 0)",
  "clutchesWon": "number (default: 0)",
  "clutchesLost": "number (default: 0)",
  "utilityDamage": "number (default: 0)",
  "flashAssists": "number (default: 0)"
}
```

**Request Body (array of players):**

```json
[
  { /* player object as above */ },
  { /* player object */ }
]
```

**Response:**

```json
{
  "processed": "number (total players processed)",
  "created": "number (new players created)",
  "updated": "number (existing players updated)",
  "failed": "number (players that failed to process)",
  "errors": ["array of error messages (only if failed > 0)"]
}
```

**Status Codes:**

- `200` - Success (full or partial)
- `400` - Bad request
- `401` - Unauthorized
- `404` - Match not found
- `500` - Server error

---

### 3. Create Match Rounds

**POST** `/api/v1/demo-matches/:matchId/rounds`

Creates round records for a match. Can accept a single round or an array of rounds. Uses `(matchId, roundNumber)` as unique constraint.

**Request Body (single round):**

```json
{
  "roundNumber": "number (required)",
  "winner": "string (required, 'CT' or 'T')",
  "winReason": "string (required, one of: 'elimination', 'defuse', 'time', 'bomb')",
  "ctScore": "number (required)",
  "tScore": "number (required)",
  "durationSeconds": "number (optional)",
  "startTick": "number (optional)",
  "endTick": "number (optional)"
}
```

**Request Body (array of rounds):**

```json
[
  { /* round object as above */ },
  { /* round object */ }
]
```

**Response:**

```json
{
  "processed": "number (total rounds processed)",
  "created": "number (new rounds created)",
  "roundIds": ["array of created/updated round IDs"],
  "failed": "number (rounds that failed to process)",
  "errors": ["array of error messages (only if failed > 0)"]
}
```

**Status Codes:**

- `200` - Success
- `400` - Bad request
- `401` - Unauthorized
- `404` - Match not found
- `500` - Server error

---

### 4. Create Round Events

**POST** `/api/v1/demo-matches/:matchId/rounds/:roundId/events`

Creates event records for a specific round. Can accept a single event or an array of events. Events are append-only (no upsert).

**Request Body (single event):**

```json
{
  "roundNumber": "number (required)",
  "eventType": "string (required, one of: 'kill', 'assist', 'death', 'flash', 'smoke', 'he', 'molotov', 'defuse', 'plant')",
  "tick": "number (required)",
  "attackerSteamId": "string (optional)",
  "victimSteamId": "string (optional)",
  "assisterSteamId": "string (optional)",
  "weapon": "string (optional)",
  "isHeadshot": "boolean (default: false)",
  "isTradeKill": "boolean (default: false)",
  "positionX": "number (optional)",
  "positionY": "number (optional)",
  "positionZ": "number (optional)",
  "eventData": "object (optional, will be JSON stringified)"
}
```

**Request Body (array of events):**

```json
[
  { /* event object as above */ },
  { /* event object */ }
]
```

**Response:**

```json
{
  "processed": "number (total events processed)",
  "created": "number (events created)",
  "eventIds": ["array of created event IDs"],
  "failed": "number (events that failed to process)",
  "errors": ["array of error messages (only if failed > 0)"]
}
```

**Status Codes:**

- `200` - Success
- `400` - Bad request
- `401` - Unauthorized
- `404` - Match or round not found
- `500` - Server error

---

### 5. Upsert Match Insights

**POST** `/api/v1/demo-matches/:matchId/insights`

Creates or updates insights and analytics for a match. One insights record per match.

**Request Body:**

```json
{
  "ctSideStats": "object (optional, will be JSON stringified)",
  "tSideStats": "object (optional, will be JSON stringified)",
  "economyAnalysis": "object (optional, will be JSON stringified)",
  "utilityUsage": "object (optional, will be JSON stringified)",
  "positioningData": "object (optional, will be JSON stringified)",
  "clutchAnalysis": "object (optional, will be JSON stringified)",
  "tradeAnalysis": "object (optional, will be JSON stringified)",
  "roundWinProbability": "object (optional, will be JSON stringified)"
}
```

**Response:**

```json
{
  "id": "string (insight record ID)",
  "matchId": "string",
  "ctSideStats": "object (if provided)",
  "tSideStats": "object (if provided)",
  "economyAnalysis": "object (if provided)",
  "utilityUsage": "object (if provided)",
  "positioningData": "object (if provided)",
  "clutchAnalysis": "object (if provided)",
  "tradeAnalysis": "object (if provided)",
  "roundWinProbability": "object (if provided)",
  "createdAt": "ISO 8601 datetime string",
  "updatedAt": "ISO 8601 datetime string"
}
```

**Status Codes:**

- `200` - Success
- `400` - Bad request
- `401` - Unauthorized
- `404` - Match not found
- `500` - Server error

---

### 6. Update Match Parse Status

**PATCH** `/api/v1/demo-matches/:matchId/parse-status`

Updates the parse status and error message for a match.

**Request Body:**

```json
{
  "parseStatus": "string (required, one of: pending, processing, completed, failed)",
  "parseError": "string (optional, error message if status is 'failed')"
}
```

**Response:**

```json
{
  "id": "string",
  "parseStatus": "string",
  "parseError": "string (if provided)",
  "updatedAt": "ISO 8601 datetime string"
}
```

**Status Codes:**

- `200` - Success
- `400` - Bad request
- `401` - Unauthorized
- `404` - Match not found
- `500` - Server error

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": "string (error message)",
  "details": "object (optional, additional error details)"
}
```

---

## Database Schema

### Required Database Tables

#### 1. Update DemoMatches Table

Add parse status fields to the existing `DemoMatches` table:

```sql
ALTER TABLE [DemoMatches] ADD [parseStatus] NVARCHAR(50) DEFAULT 'pending';
ALTER TABLE [DemoMatches] ADD [parseError] NVARCHAR(MAX);

CREATE INDEX IX_DemoMatches_ParseStatus ON [DemoMatches]([parseStatus]);
```

#### 2. DemoMatchPlayers Table

```sql
CREATE TABLE [DemoMatchPlayers] (
    [id] NVARCHAR(255) PRIMARY KEY DEFAULT NEWID(),
    [matchId] NVARCHAR(255) NOT NULL,
    [steamId] NVARCHAR(255) NOT NULL,
    [playerName] NVARCHAR(255) NOT NULL,
    [team] NVARCHAR(10) NOT NULL CHECK ([team] IN ('CT', 'T')),
    [kills] INT DEFAULT 0,
    [deaths] INT DEFAULT 0,
    [assists] INT DEFAULT 0,
    [adr] FLOAT DEFAULT 0,
    [headshotPercentage] FLOAT DEFAULT 0,
    [firstKills] INT DEFAULT 0,
    [firstDeaths] INT DEFAULT 0,
    [tradeKills] INT DEFAULT 0,
    [clutchesWon] INT DEFAULT 0,
    [clutchesLost] INT DEFAULT 0,
    [utilityDamage] FLOAT DEFAULT 0,
    [flashAssists] INT DEFAULT 0,
    [createdAt] DATETIME DEFAULT GETDATE(),
    [updatedAt] DATETIME DEFAULT GETDATE(),
    FOREIGN KEY ([matchId]) REFERENCES [DemoMatches]([id]) ON DELETE CASCADE,
    UNIQUE ([matchId], [steamId])
);

CREATE INDEX IX_DemoMatchPlayers_MatchId ON [DemoMatchPlayers]([matchId]);
CREATE INDEX IX_DemoMatchPlayers_SteamId ON [DemoMatchPlayers]([steamId]);
```

#### 3. DemoMatchRounds Table

```sql
CREATE TABLE [DemoMatchRounds] (
    [id] NVARCHAR(255) PRIMARY KEY DEFAULT NEWID(),
    [matchId] NVARCHAR(255) NOT NULL,
    [roundNumber] INT NOT NULL,
    [winner] NVARCHAR(10) NOT NULL CHECK ([winner] IN ('CT', 'T')),
    [winReason] NVARCHAR(50) NOT NULL CHECK ([winReason] IN ('elimination', 'defuse', 'time', 'bomb')),
    [ctScore] INT NOT NULL,
    [tScore] INT NOT NULL,
    [durationSeconds] INT,
    [startTick] INT,
    [endTick] INT,
    [createdAt] DATETIME DEFAULT GETDATE(),
    FOREIGN KEY ([matchId]) REFERENCES [DemoMatches]([id]) ON DELETE CASCADE,
    UNIQUE ([matchId], [roundNumber])
);

CREATE INDEX IX_DemoMatchRounds_MatchId ON [DemoMatchRounds]([matchId]);
```

#### 4. DemoRoundEvents Table

```sql
CREATE TABLE [DemoRoundEvents] (
    [id] NVARCHAR(255) PRIMARY KEY DEFAULT NEWID(),
    [roundId] NVARCHAR(255) NOT NULL,
    [matchId] NVARCHAR(255) NOT NULL,
    [roundNumber] INT NOT NULL,
    [eventType] NVARCHAR(50) NOT NULL CHECK ([eventType] IN ('kill', 'assist', 'death', 'flash', 'smoke', 'he', 'molotov', 'defuse', 'plant')),
    [tick] INT NOT NULL,
    [attackerSteamId] NVARCHAR(255),
    [victimSteamId] NVARCHAR(255),
    [assisterSteamId] NVARCHAR(255),
    [weapon] NVARCHAR(255),
    [isHeadshot] BIT DEFAULT 0,
    [isTradeKill] BIT DEFAULT 0,
    [positionX] FLOAT,
    [positionY] FLOAT,
    [positionZ] FLOAT,
    [eventData] NVARCHAR(MAX), -- JSON
    [createdAt] DATETIME DEFAULT GETDATE(),
    FOREIGN KEY ([roundId]) REFERENCES [DemoMatchRounds]([id]) ON DELETE CASCADE,
    FOREIGN KEY ([matchId]) REFERENCES [DemoMatches]([id]) ON DELETE NO ACTION
);

CREATE INDEX IX_DemoRoundEvents_RoundId ON [DemoRoundEvents]([roundId]);
CREATE INDEX IX_DemoRoundEvents_MatchId ON [DemoRoundEvents]([matchId]);
CREATE INDEX IX_DemoRoundEvents_EventType ON [DemoRoundEvents]([eventType]);
```

#### 5. DemoMatchInsights Table

```sql
CREATE TABLE [DemoMatchInsights] (
    [id] NVARCHAR(255) PRIMARY KEY DEFAULT NEWID(),
    [matchId] NVARCHAR(255) NOT NULL UNIQUE,
    [ctSideStats] NVARCHAR(MAX), -- JSON
    [tSideStats] NVARCHAR(MAX), -- JSON
    [economyAnalysis] NVARCHAR(MAX), -- JSON
    [utilityUsage] NVARCHAR(MAX), -- JSON
    [positioningData] NVARCHAR(MAX), -- JSON
    [clutchAnalysis] NVARCHAR(MAX), -- JSON
    [tradeAnalysis] NVARCHAR(MAX), -- JSON
    [roundWinProbability] NVARCHAR(MAX), -- JSON
    [createdAt] DATETIME DEFAULT GETDATE(),
    [updatedAt] DATETIME DEFAULT GETDATE(),
    FOREIGN KEY ([matchId]) REFERENCES [DemoMatches]([id]) ON DELETE CASCADE
);

CREATE INDEX IX_DemoMatchInsights_MatchId ON [DemoMatchInsights]([matchId]);
```

---

## Implementation Notes

1. **ID Format**: All IDs should use UUID format (e.g., `crypto.randomUUID()` in Node.js or `NEWID()` in SQL Server).

2. **Datetime Format**: All datetime fields must be in ISO 8601 format (e.g., `2025-11-28T12:34:56.789Z`).

3. **JSON Fields**: JSON fields (teams, highlights, eventData, etc.) should be sent as JSON objects in the request body but will be stored as JSON strings (`NVARCHAR(MAX)`) in the database.

4. **Idempotency**: The following operations are idempotent:
   - Creating/updating demo matches (upsert by ID)
   - Upserting match players (upsert by matchId + steamId)
   - Creating rounds (upsert by matchId + roundNumber)
   - Upserting match insights (upsert by matchId)

5. **Batch Operations**: Endpoints accepting arrays should process all items and return detailed statistics (processed, created, updated, failed counts). Prefer atomic transactions where possible.

6. **Validation**: The API validates:
   - Required fields are present and non-null
   - Enum values (team, winReason, eventType, parseStatus) match allowed values
   - Foreign key relationships exist (match exists before creating players/rounds/insights)
   - Data types are correct

7. **Cascading Deletes**: When a match is deleted, all related records (players, rounds, events, insights) are automatically deleted via `ON DELETE CASCADE`.

8. **Authentication**: All write endpoints (POST, PUT, PATCH, DELETE) require authentication. Read endpoints (GET) may be public or protected based on your requirements.

9. **CORS**: The API should support CORS for cross-origin requests with appropriate headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`).

10. **Rate Limiting**: Consider implementing rate limiting for write endpoints to prevent abuse, especially from automated workers.


