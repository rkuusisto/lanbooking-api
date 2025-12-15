# Match Analytics API Documentation

> Statistical analysis and insights for CS2 demo matches

## Overview

The Match Analytics API provides comprehensive statistical analysis of CS2 matches parsed from demo files. All data is derived from the `DemoMatchPlayers`, `DemoMatchRounds`, and `DemoRoundEvents` tables.

**Base URL:** `/api/v1/analytics`

### Key Features

- **Immutable Data**: Match statistics are historical and never change, enabling aggressive caching
- **ETag Support**: All endpoints return ETags for conditional requests
- **Structured Response**: Consistent JSON response format across all endpoints

### Caching Behavior

All analytics endpoints support HTTP caching:

```
Cache-Control: public, max-age=3600, s-maxage=86400
ETag: "abc123..."
```

Use conditional requests to minimize bandwidth:

```javascript
fetch('/api/v1/analytics/matches/abc-123', {
  headers: {
    'If-None-Match': '"previously-received-etag"'
  }
});
// Returns 304 Not Modified if data unchanged
```

---

## Endpoints

### 1. Complete Match Analytics

Get a comprehensive summary of all match statistics in a single request.

```
GET /api/v1/analytics/matches/:matchId
```

#### Response

```json
{
  "matchId": "abc-123-def",
  "map": "de_dust2",
  "teams": [
    { "name": "Team Alpha", "score": 16 },
    { "name": "Team Beta", "score": 12 }
  ],
  "playedAt": "2024-12-07T14:30:00.000Z",
  "durationMinutes": 45,
  "totalRounds": 28,
  
  "finalScore": {
    "CT": 16,
    "T": 12
  },
  
  "mvp": {
    "match": {
      "steamId": "76561198012345678",
      "playerName": "PlayerOne",
      "team": "CT",
      "kills": 28,
      "deaths": 15,
      "assists": 5,
      "adr": 95.2,
      "mvpScore": 78.5
    },
    "teams": {
      "CT": { /* player stats */ },
      "T": { /* player stats */ }
    }
  },
  
  "playerStats": [
    {
      "steamId": "76561198012345678",
      "playerName": "PlayerOne",
      "team": "CT",
      "kills": 28,
      "deaths": 15,
      "assists": 5,
      "adr": 95.2,
      "headshotPercentage": 48.5,
      "kd": 1.87,
      "kdDiff": 13,
      "impactRating": 1.24,
      "kast": 75,
      "firstKills": 8,
      "firstDeaths": 3,
      "openingDuelSuccess": 73,
      "clutchesWon": 2,
      "clutchesLost": 1,
      "clutchSuccess": 67,
      "tradeKills": 4,
      "utilityDamage": 120,
      "flashAssists": 3,
      "utilityEfficiency": 180,
      "mvpScore": 78.5
    }
    // ... more players sorted by mvpScore
  ],
  
  "progression": {
    "mostImproved": {
      "steamId": "76561198012345678",
      "playerName": "PlayerTwo",
      "team": "T",
      "improvementScore": 15.3,
      "firstHalfKD": 0.8,
      "secondHalfKD": 1.5
    },
    "mostDeclined": {
      "steamId": "76561198087654321",
      "playerName": "PlayerThree",
      "team": "CT",
      "improvementScore": -12.1,
      "firstHalfKD": 1.6,
      "secondHalfKD": 0.9
    }
  },
  
  "momentum": {
    "winStreaks": {
      "CT": { "max": 5, "total": 16 },
      "T": { "max": 3, "total": 12 },
      "notableStreaks": [
        { "team": "CT", "length": 5, "startRound": 8 }
      ]
    },
    "comebacks": [
      { "team": "T", "roundNumber": 18, "deficit": 5, "newLead": 1 }
    ],
    "swings": [
      { "roundNumber": 15, "ctScore": 10, "tScore": 5, "momentum": 3 }
    ]
  },
  
  "highlights": [
    {
      "type": "ace",
      "steamId": "76561198012345678",
      "playerName": "PlayerOne",
      "team": "CT",
      "kills": 5,
      "roundNumber": 12,
      "weight": 100
    },
    {
      "type": "clutch",
      "steamId": "76561198012345678",
      "playerName": "PlayerTwo",
      "team": "T",
      "situation": "1v3",
      "killsInClutch": 3,
      "roundNumber": 22,
      "weight": 110
    }
  ],
  
  "generatedAt": "2024-12-07T15:00:00.000Z"
}
```

---

### 2. MVP Analysis

Get detailed MVP information for the match.

```
GET /api/v1/analytics/matches/:matchId/mvp
```

#### Response

```json
{
  "matchMVP": {
    "steamId": "76561198012345678",
    "playerName": "PlayerOne",
    "team": "CT",
    "kills": 28,
    "deaths": 15,
    "assists": 5,
    "adr": 95.2,
    "headshotPercentage": 48.5,
    "kd": 1.87,
    "mvpScore": 78.5
    // ... full player stats
  },
  
  "teamMVPs": {
    "CT": { /* CT team MVP stats */ },
    "T": { /* T team MVP stats */ }
  },
  
  "roundMVPs": [
    {
      "steamId": "76561198012345678",
      "playerName": "PlayerOne",
      "team": "CT",
      "roundNumber": 1,
      "kills": 3,
      "deaths": 0,
      "assists": 1,
      "headshots": 2,
      "openingKill": true,
      "tradeKills": 1,
      "mvpScore": 105
    }
    // ... one entry per round
  ],
  
  "mvpLeaderboard": [
    {
      "steamId": "76561198012345678",
      "playerName": "PlayerOne",
      "team": "CT",
      "count": 12,
      "rounds": [1, 3, 5, 8, 10, 12, 15, 18, 20, 22, 25, 27]
    },
    {
      "steamId": "76561198087654321",
      "playerName": "PlayerTwo",
      "team": "T",
      "count": 8,
      "rounds": [2, 4, 6, 9, 14, 19, 23, 26]
    }
  ]
}
```

---

### 3. Round-by-Round Analysis

Get detailed breakdown of each round with MVP and events.

```
GET /api/v1/analytics/matches/:matchId/rounds/mvp
```

#### Response

```json
[
  {
    "roundNumber": 1,
    "winner": "CT",
    "winReason": "elimination",
    "scoreCT": 1,
    "scoreT": 0,
    "totalKills": 5,
    "headshots": 3,
    "tradeKills": 1,
    "weapons": {
      "ak47": 2,
      "m4a1_silencer": 2,
      "awp": 1
    },
    "mvp": {
      "steamId": "76561198012345678",
      "playerName": "PlayerOne",
      "team": "CT",
      "roundNumber": 1,
      "kills": 3,
      "deaths": 0,
      "assists": 1,
      "headshots": 2,
      "openingKill": true,
      "tradeKills": 1,
      "mvpScore": 105
    }
  }
  // ... one entry per round
]
```

---

### 4. Match Highlights

Get notable moments: aces, clutches, multi-kills, ninja defuses.

```
GET /api/v1/analytics/matches/:matchId/highlights
GET /api/v1/analytics/matches/:matchId/highlights?limit=20
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 15 | Maximum highlights to return |

#### Response

```json
{
  "topHighlights": [
    {
      "type": "ace",
      "steamId": "76561198012345678",
      "playerName": "PlayerOne",
      "team": "CT",
      "kills": 5,
      "weapons": ["ak47", "deagle"],
      "headshots": 3,
      "roundNumber": 12,
      "weight": 100
    },
    {
      "type": "clutch",
      "steamId": "76561198087654321",
      "playerName": "PlayerTwo",
      "team": "T",
      "situation": "1v3",
      "killsInClutch": 3,
      "roundNumber": 22,
      "winReason": "elimination",
      "weight": 110
    },
    {
      "type": "quad_kill",
      "steamId": "76561198012345678",
      "playerName": "PlayerOne",
      "team": "CT",
      "count": 4,
      "roundNumber": 5,
      "weight": 60
    },
    {
      "type": "ninja_defuse",
      "steamId": "76561198012345678",
      "playerName": "PlayerThree",
      "roundNumber": 18,
      "terroristsAlive": 3,
      "weight": 70
    }
  ],
  
  "byType": {
    "aces": [ /* ace highlights */ ],
    "clutches": [ /* clutch highlights */ ],
    "multiKills": [ /* triple/quad kills */ ],
    "ninjaDefuses": [ /* ninja defuses */ ]
  },
  
  "playerHighlightCounts": [
    { "steamId": "76561198012345678", "playerName": "PlayerOne", "team": "CT", "count": 5 },
    { "steamId": "76561198087654321", "playerName": "PlayerTwo", "team": "T", "count": 3 }
  ],
  
  "totalHighlights": 15
}
```

#### Highlight Types

| Type | Description | Weight |
|------|-------------|--------|
| `ace` | 5 kills in a single round | 100 |
| `clutch` | 1vX situation won | 80 + (kills × 10) |
| `ninja_defuse` | Defuse with 2+ terrorists alive | 70 |
| `quad_kill` | 4 kills in a round | 60 |
| `triple_kill` | 3 kills in a round | 40 |
| `double_kill` | 2 rapid kills | 10 |

---

### 5. Player Progression

Analyze how players performed across the match halves.

```
GET /api/v1/analytics/matches/:matchId/progression
```

#### Response

```json
{
  "mostImproved": {
    "steamId": "76561198012345678",
    "playerName": "PlayerTwo",
    "team": "T",
    
    "halfComparison": {
      "firstHalf": {
        "roundCount": 14,
        "kills": 8,
        "deaths": 10,
        "assists": 3,
        "headshots": 4,
        "openingKills": 1,
        "openingDeaths": 3,
        "killsPerRound": 0.57,
        "deathsPerRound": 0.71,
        "kd": 0.8,
        "headshotRate": 50
      },
      "secondHalf": {
        "roundCount": 14,
        "kills": 18,
        "deaths": 8,
        "assists": 4,
        "headshots": 10,
        "openingKills": 4,
        "openingDeaths": 1,
        "killsPerRound": 1.29,
        "deathsPerRound": 0.57,
        "kd": 2.25,
        "headshotRate": 56
      },
      "delta": {
        "killsPerRoundDelta": 0.72,
        "deathsPerRoundDelta": -0.14,
        "kdDelta": 1.45,
        "headshotRateDelta": 6,
        "improvementScore": 35.2
      }
    },
    
    "quarterlyProgression": {
      "quarters": [
        { "quarter": 1, "startRound": 1, "endRound": 7, "performance": { /* stats */ } },
        { "quarter": 2, "startRound": 8, "endRound": 14, "performance": { /* stats */ } },
        { "quarter": 3, "startRound": 15, "endRound": 21, "performance": { /* stats */ } },
        { "quarter": 4, "startRound": 22, "endRound": 28, "performance": { /* stats */ } }
      ],
      "trend": "improving",
      "bestQuarter": { "quarter": 4, /* ... */ },
      "worstQuarter": { "quarter": 1, /* ... */ }
    },
    
    "trend": "improving",
    "improvementScore": 35.2,
    
    "narrative": "PlayerTwo showed consistent improvement throughout the match. K/D improved significantly (+1.45) in the second half. Best performance in Q4 (rounds 22-28) with 1.50 kills/round."
  },
  
  "mostDeclined": {
    "steamId": "76561198087654321",
    "playerName": "PlayerThree",
    "team": "CT",
    "improvementScore": -18.5,
    // ... same structure as mostImproved
  },
  
  "rankings": [
    { "rank": 1, "steamId": "76561198012345678", "playerName": "PlayerTwo", "team": "T", "improvementScore": 35.2 },
    { "rank": 2, "steamId": "76561198099999999", "playerName": "PlayerFour", "team": "CT", "improvementScore": 12.1 },
    // ... all players ranked by improvement
    { "rank": 10, "steamId": "76561198087654321", "playerName": "PlayerThree", "team": "CT", "improvementScore": -18.5 }
  ],
  
  "summary": {
    "totalPlayers": 10,
    "improvedPlayers": 4,
    "declinedPlayers": 3,
    "stablePlayers": 3
  }
}
```

---

### 6. Individual Player Progression

Get detailed progression for a specific player.

```
GET /api/v1/analytics/matches/:matchId/progression/:steamId
```

#### Response

Same structure as `mostImproved` in the progression endpoint above.

---

### 7. Team Analytics

Get team-based statistics comparison.

```
GET /api/v1/analytics/matches/:matchId/teams
```

#### Response

```json
{
  "teams": [
    { "name": "Team Alpha", "score": 16 },
    { "name": "Team Beta", "score": 12 }
  ],
  
  "CT": {
    "players": 5,
    "stats": {
      "totalKills": 85,
      "totalDeaths": 70,
      "totalAssists": 25,
      "avgADR": 82,
      "avgHeadshotPct": 45,
      "totalFirstKills": 15,
      "totalClutchesWon": 4
    },
    "roundsWon": 16,
    "winReasons": {
      "elimination": 10,
      "defuse": 4,
      "time": 2
    },
    "mvp": { /* team MVP stats */ }
  },
  
  "T": {
    "players": 5,
    "stats": {
      "totalKills": 70,
      "totalDeaths": 85,
      "totalAssists": 20,
      "avgADR": 75,
      "avgHeadshotPct": 42,
      "totalFirstKills": 13,
      "totalClutchesWon": 2
    },
    "roundsWon": 12,
    "winReasons": {
      "elimination": 6,
      "bomb": 6
    },
    "mvp": { /* team MVP stats */ }
  },
  
  "comparison": {
    "killDiff": 15,
    "adrDiff": 7,
    "roundDiff": 4
  }
}
```

---

### 8. Weapon Statistics

Get weapon usage and effectiveness data.

```
GET /api/v1/analytics/matches/:matchId/weapons
```

#### Response

```json
{
  "overview": [
    { "weapon": "ak47", "kills": 45, "headshots": 22, "headshotRate": 49 },
    { "weapon": "m4a1_silencer", "kills": 32, "headshots": 18, "headshotRate": 56 },
    { "weapon": "awp", "kills": 28, "headshots": 0, "headshotRate": 0 },
    { "weapon": "deagle", "kills": 12, "headshots": 8, "headshotRate": 67 }
    // ... sorted by kills
  ],
  
  "playerFavorites": [
    {
      "steamId": "76561198012345678",
      "playerName": "PlayerOne",
      "team": "CT",
      "favoriteWeapon": "ak47",
      "favoriteWeaponKills": 15,
      "weaponBreakdown": [
        { "weapon": "ak47", "kills": 15, "headshots": 8 },
        { "weapon": "awp", "kills": 8, "headshots": 0 },
        { "weapon": "deagle", "kills": 5, "headshots": 3 }
      ]
    }
    // ... per player
  ],
  
  "mostDeadlyWeapon": {
    "weapon": "ak47",
    "kills": 45,
    "headshots": 22,
    "headshotRate": 49
  },
  
  "highestHSRateWeapon": {
    "weapon": "deagle",
    "kills": 12,
    "headshots": 8,
    "headshotRate": 67
  }
}
```

---

### 9. Opening Duel Statistics

Analyze first blood patterns and conversion rates.

```
GET /api/v1/analytics/matches/:matchId/opening-duels
```

#### Response

```json
{
  "totalOpeningDuels": 28,
  
  "team": {
    "CT": {
      "openingWins": 15,
      "conversions": 13,
      "conversionRate": 87
    },
    "T": {
      "openingWins": 13,
      "conversions": 10,
      "conversionRate": 77
    }
  },
  
  "playerStats": [
    {
      "steamId": "76561198012345678",
      "playerName": "PlayerOne",
      "openingWins": 8,
      "openingLosses": 3,
      "openingRating": 73,
      "conversions": 7
    }
    // ... sorted by openingRating
  ],
  
  "bestOpener": {
    "steamId": "76561198012345678",
    "playerName": "PlayerOne",
    "openingWins": 8,
    "openingLosses": 3,
    "openingRating": 73,
    "conversions": 7
  },
  
  "duels": [
    {
      "roundNumber": 1,
      "winner": "CT",
      "roundWinner": "CT",
      "wasConvertedToRoundWin": true,
      "attackerSteamId": "76561198012345678",
      "attackerName": "PlayerOne",
      "victimSteamId": "76561198087654321",
      "victimName": "PlayerTwo",
      "weapon": "ak47"
    }
    // ... one per round
  ]
}
```

---

### 10. Trade Kill Analysis

Analyze trade kill efficiency.

```
GET /api/v1/analytics/matches/:matchId/trades
```

#### Response

```json
{
  "totalTradeKills": 25,
  "tradeKillPercentage": 16,
  
  "team": {
    "CT": {
      "tradeKills": 14,
      "percentage": 16
    },
    "T": {
      "tradeKills": 11,
      "percentage": 16
    }
  },
  
  "playerStats": [
    {
      "steamId": "76561198012345678",
      "playerName": "PlayerOne",
      "team": "CT",
      "tradeKills": 6,
      "deathsTraded": 2
    }
    // ... sorted by tradeKills
  ],
  
  "bestTrader": {
    "steamId": "76561198012345678",
    "playerName": "PlayerOne",
    "team": "CT",
    "tradeKills": 6,
    "deathsTraded": 2
  }
}
```

---

## Cache Management Endpoints

> **⚠️ Authentication Required**: All cache management endpoints require authentication via Bearer token.

### Get Cache Statistics

Get current cache statistics including hit rate and size.

```
GET /api/v1/analytics/cache/stats
```

**Authentication**: Not required (read-only statistics)

#### Response

```json
{
  "hits": 1250,
  "misses": 45,
  "size": 32,
  "hitRate": 97
}
```

### Invalidate Match Cache

Force refresh of cached data for a specific match. Requires authentication.

```
DELETE /api/v1/analytics/cache/:matchId
```

**Authentication**: Required (Bearer token)

#### Headers

```
Authorization: Bearer <token>
```

#### Response

```json
{
  "success": true,
  "message": "Cache invalidated for match abc-123-def"
}
```

#### Error Responses

| Status Code | Description |
|-------------|-------------|
| 401 | Missing or invalid authentication token |
| 404 | Match not found (or no cached data for match) |

### Clear All Cache

Clear the entire analytics cache. Requires authentication.

```
DELETE /api/v1/analytics/cache
```

**Authentication**: Required (Bearer token)

#### Headers

```
Authorization: Bearer <token>
```

#### Response

```json
{
  "success": true,
  "message": "Analytics cache cleared"
}
```

#### Error Responses

| Status Code | Description |
|-------------|-------------|
| 401 | Missing or invalid authentication token |

#### Notes

- Cache has a maximum size limit (default: 1000 entries) with LRU eviction
- Cache invalidation endpoints are protected to prevent DoS via cache flushing attacks
- Use these endpoints sparingly, as clearing cache will increase database load

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": "Match not found"
}
```

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 304 | Not Modified (cache hit with matching ETag) |
| 404 | Match or player not found |
| 500 | Server error |

---

## TypeScript Interfaces

```typescript
interface PlayerStats {
  steamId: string;
  playerName: string;
  team: 'CT' | 'T';
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  headshotPercentage: number;
  kd: number;
  kdDiff: number;
  impactRating: number;
  kast: number;
  firstKills: number;
  firstDeaths: number;
  openingDuelSuccess: number;
  clutchesWon: number;
  clutchesLost: number;
  clutchSuccess: number;
  tradeKills: number;
  utilityDamage: number;
  flashAssists: number;
  utilityEfficiency: number;
  mvpScore: number;
}

interface Highlight {
  type: 'ace' | 'clutch' | 'quad_kill' | 'triple_kill' | 'double_kill' | 'ninja_defuse';
  steamId: string;
  playerName: string;
  team: 'CT' | 'T';
  roundNumber: number;
  weight: number;
  // Type-specific fields
  kills?: number;
  situation?: string;
  killsInClutch?: number;
  terroristsAlive?: number;
}

interface MatchAnalytics {
  matchId: string;
  map: string;
  teams: Array<{ name: string; score: number }>;
  playedAt: string;
  durationMinutes: number;
  totalRounds: number;
  finalScore: { CT: number; T: number };
  mvp: {
    match: PlayerStats;
    teams: { CT: PlayerStats; T: PlayerStats };
  };
  playerStats: PlayerStats[];
  progression: {
    mostImproved: PlayerProgression | null;
    mostDeclined: PlayerProgression | null;
  };
  momentum: MomentumData;
  highlights: Highlight[];
  generatedAt: string;
}
```

---

## Usage Examples

### JavaScript/Fetch

```javascript
// Get complete match analytics
const response = await fetch('/api/v1/analytics/matches/abc-123');
const analytics = await response.json();

console.log(`Match MVP: ${analytics.mvp.match.playerName}`);
console.log(`Most Improved: ${analytics.progression.mostImproved?.playerName}`);

// Display highlights
analytics.highlights.forEach(h => {
  console.log(`${h.type}: ${h.playerName} in round ${h.roundNumber}`);
});
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

function useMatchAnalytics(matchId: string) {
  const [data, setData] = useState<MatchAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let etag: string | null = null;
    
    async function fetchData() {
      try {
        const headers: HeadersInit = {};
        if (etag) headers['If-None-Match'] = etag;
        
        const res = await fetch(`/api/v1/analytics/matches/${matchId}`, { headers });
        
        if (res.status === 304) return; // Data unchanged
        if (!res.ok) throw new Error('Failed to fetch');
        
        etag = res.headers.get('ETag');
        const json = await res.json();
        setData(json);
      } catch (e) {
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [matchId]);

  return { data, loading, error };
}
```

---

## Metric Definitions

| Metric | Formula | Description |
|--------|---------|-------------|
| **MVP Score** | Weighted combination | Composite score (0-100+) based on ADR, K/D, impact, clutches |
| **Impact Rating** | (K + 0.75×A + 2×Clutches - 0.5×D) / Rounds | Per-round contribution score |
| **KAST** | (K + A + Trades) / Rounds × 100 | Kill/Assist/Survived/Trade percentage |
| **Opening Duel Success** | First Kills / (First Kills + First Deaths) × 100 | Win rate in opening duels |
| **Clutch Success** | Clutches Won / (Won + Lost) × 100 | Clutch round win rate |
| **Improvement Score** | KPR∆×40 + DPR∆×30 + KD∆×20 + HS∆×0.1 | Performance change between halves |

---

## Rate Limits

The analytics endpoints share rate limits with other API endpoints:
- **100 requests** per 15 minutes per IP (standard)
- Consider caching responses client-side using ETags

---

## Changelog

### v1.0.0 (2024-12-07)
- Initial release
- Complete match analytics endpoint
- MVP analysis (match, team, round)
- Highlight detection (aces, clutches, multi-kills)
- Player progression analysis
- Team analytics
- Weapon statistics
- Opening duel analysis
- Trade kill analysis
- In-memory caching with ETag support




