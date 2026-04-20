/**
 * Player Progression Analytics Operative Functions
 * 
 * Functions for analyzing player performance trends throughout a match.
 * Detects improvement, decline, and consistency patterns.
 */

// ============================================================================
// Half-based Analysis
// ============================================================================

/**
 * Split rounds into halves (first 12 vs second 12 in standard matches)
 * @param {Array} rounds - All rounds
 * @returns {Object} - First half and second half rounds
 */
export function splitRoundsIntoHalves(rounds) {
  const halfwayPoint = Math.ceil(rounds.length / 2);
  return {
    firstHalf: rounds.slice(0, halfwayPoint),
    secondHalf: rounds.slice(halfwayPoint),
  };
}

/**
 * Calculate player performance in a set of rounds
 * @param {string} steamId - Player's Steam ID
 * @param {Array} events - Events for the rounds
 * @param {Array} rounds - The rounds to analyze
 * @returns {Object} - Performance metrics
 */
export function calculatePerformanceInRounds(steamId, events, rounds) {
  const roundNumbers = new Set(rounds.map(r => r.roundNumber));
  const relevantEvents = events.filter(e => roundNumbers.has(e.roundNumber));
  const killEvents = relevantEvents.filter(e => e.eventType === 'kill');
  
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let headshots = 0;
  let openingKills = 0;
  let openingDeaths = 0;
  
  // Group kills by round to find opening kills
  const killsByRound = {};
  killEvents.forEach(event => {
    if (!killsByRound[event.roundNumber]) {
      killsByRound[event.roundNumber] = [];
    }
    killsByRound[event.roundNumber].push(event);
  });
  
  // Calculate stats
  killEvents.forEach(event => {
    if (event.attackerSteamId === steamId) {
      kills++;
      if (event.isHeadshot) headshots++;
    }
    if (event.victimSteamId === steamId) {
      deaths++;
    }
    if (event.assisterSteamId === steamId) {
      assists++;
    }
  });
  
  // Count opening duels
  Object.entries(killsByRound).forEach(([roundNum, roundKills]) => {
    if (roundKills.length > 0) {
      const firstKill = roundKills[0];
      if (firstKill.attackerSteamId === steamId) openingKills++;
      if (firstKill.victimSteamId === steamId) openingDeaths++;
    }
  });
  
  const roundCount = rounds.length;
  
  return {
    roundCount,
    kills,
    deaths,
    assists,
    headshots,
    openingKills,
    openingDeaths,
    killsPerRound: roundCount > 0 ? Math.round((kills / roundCount) * 100) / 100 : 0,
    deathsPerRound: roundCount > 0 ? Math.round((deaths / roundCount) * 100) / 100 : 0,
    kd: deaths > 0 ? Math.round((kills / deaths) * 100) / 100 : kills,
    headshotRate: kills > 0 ? Math.round((headshots / kills) * 100) : 0,
  };
}

/**
 * Calculate performance difference between two periods
 * @param {Object} earlier - Earlier period performance
 * @param {Object} later - Later period performance
 * @returns {Object} - Performance delta
 */
export function calculatePerformanceDelta(earlier, later) {
  return {
    killsPerRoundDelta: Math.round((later.killsPerRound - earlier.killsPerRound) * 100) / 100,
    deathsPerRoundDelta: Math.round((later.deathsPerRound - earlier.deathsPerRound) * 100) / 100,
    kdDelta: Math.round((later.kd - earlier.kd) * 100) / 100,
    headshotRateDelta: later.headshotRate - earlier.headshotRate,
    
    // Improvement score: positive = better in second half
    improvementScore: 
      ((later.killsPerRound - earlier.killsPerRound) * 40) +
      ((earlier.deathsPerRound - later.deathsPerRound) * 30) +
      ((later.kd - earlier.kd) * 20) +
      ((later.headshotRate - earlier.headshotRate) * 0.1),
  };
}

// ============================================================================
// Quarter-based Analysis (More Granular)
// ============================================================================

/**
 * Split rounds into quarters for detailed progression analysis
 * @param {Array} rounds - All rounds
 * @returns {Array} - Array of quarter objects
 */
export function splitRoundsIntoQuarters(rounds) {
  const quarterSize = Math.ceil(rounds.length / 4);
  const quarters = [];
  
  for (let i = 0; i < 4; i++) {
    const start = i * quarterSize;
    const end = Math.min(start + quarterSize, rounds.length);
    if (start < rounds.length) {
      quarters.push({
        quarter: i + 1,
        rounds: rounds.slice(start, end),
        startRound: rounds[start]?.roundNumber || 0,
        endRound: rounds[Math.min(end - 1, rounds.length - 1)]?.roundNumber || 0,
      });
    }
  }
  
  return quarters;
}

/**
 * Analyze player progression across quarters
 * @param {string} steamId - Player's Steam ID
 * @param {Array} events - All match events
 * @param {Array} rounds - All match rounds
 * @returns {Object} - Quarterly progression data
 */
export function analyzeQuarterlyProgression(steamId, events, rounds) {
  const quarters = splitRoundsIntoQuarters(rounds);
  
  const quarterlyPerformance = quarters.map(q => ({
    quarter: q.quarter,
    startRound: q.startRound,
    endRound: q.endRound,
    performance: calculatePerformanceInRounds(steamId, events, q.rounds),
  }));
  
  // Calculate trend line (linear regression of kills per round)
  const kprValues = quarterlyPerformance.map(q => q.performance.killsPerRound);
  const trend = calculateTrendDirection(kprValues);
  
  return {
    quarters: quarterlyPerformance,
    trend,
    bestQuarter: quarterlyPerformance.reduce((best, q) => 
      q.performance.killsPerRound > best.performance.killsPerRound ? q : best
    ),
    worstQuarter: quarterlyPerformance.reduce((worst, q) =>
      q.performance.killsPerRound < worst.performance.killsPerRound ? q : worst
    ),
  };
}

/**
 * Calculate trend direction from a series of values
 * @param {Array<number>} values - Series of values
 * @returns {string} - 'improving', 'declining', or 'stable'
 */
export function calculateTrendDirection(values) {
  if (values.length < 2) return 'stable';
  
  // Simple linear regression
  const n = values.length;
  const indices = Array.from({ length: n }, (_, i) => i);
  
  const sumX = indices.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = indices.reduce((acc, x, i) => acc + x * values[i], 0);
  const sumXX = indices.reduce((acc, x) => acc + x * x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  
  // Determine trend based on slope
  if (slope > 0.05) return 'improving';
  if (slope < -0.05) return 'declining';
  return 'stable';
}

// ============================================================================
// Player Progression Ranking
// ============================================================================

/**
 * Analyze all players' progression and find most improved/declined
 * @param {Array} players - All players
 * @param {Array} events - All events
 * @param {Array} rounds - All rounds
 * @returns {Object} - Progression analysis for all players
 */
export function analyzeAllPlayersProgression(players, events, rounds) {
  const { firstHalf, secondHalf } = splitRoundsIntoHalves(rounds);
  
  const playerProgressions = players.map(player => {
    const firstHalfPerf = calculatePerformanceInRounds(player.steamId, events, firstHalf);
    const secondHalfPerf = calculatePerformanceInRounds(player.steamId, events, secondHalf);
    const delta = calculatePerformanceDelta(firstHalfPerf, secondHalfPerf);
    
    return {
      steamId: player.steamId,
      playerName: player.playerName,
      team: player.team,
      firstHalf: firstHalfPerf,
      secondHalf: secondHalfPerf,
      delta,
      improvementScore: delta.improvementScore,
    };
  });
  
  // Sort by improvement score
  const sorted = [...playerProgressions].sort((a, b) => b.improvementScore - a.improvementScore);
  
  return {
    allPlayers: playerProgressions,
    mostImproved: sorted[0] || null,
    mostDeclined: sorted[sorted.length - 1] || null,
    rankings: sorted.map((p, i) => ({
      rank: i + 1,
      steamId: p.steamId,
      playerName: p.playerName,
      team: p.team,
      improvementScore: Math.round(p.improvementScore * 100) / 100,
    })),
  };
}

/**
 * Get detailed progression report for a specific player
 * @param {Object} player - Player object
 * @param {Array} events - All events
 * @param {Array} rounds - All rounds
 * @returns {Object} - Detailed progression report
 */
export function getPlayerProgressionReport(player, events, rounds) {
  const { firstHalf, secondHalf } = splitRoundsIntoHalves(rounds);
  const quarterlyData = analyzeQuarterlyProgression(player.steamId, events, rounds);
  
  const firstHalfPerf = calculatePerformanceInRounds(player.steamId, events, firstHalf);
  const secondHalfPerf = calculatePerformanceInRounds(player.steamId, events, secondHalf);
  const delta = calculatePerformanceDelta(firstHalfPerf, secondHalfPerf);
  
  return {
    steamId: player.steamId,
    playerName: player.playerName,
    team: player.team,
    
    halfComparison: {
      firstHalf: firstHalfPerf,
      secondHalf: secondHalfPerf,
      delta,
    },
    
    quarterlyProgression: quarterlyData,
    
    trend: quarterlyData.trend,
    improvementScore: Math.round(delta.improvementScore * 100) / 100,
    
    narrative: generateProgressionNarrative(player.playerName, delta, quarterlyData),
  };
}

/**
 * Generate human-readable narrative about player's progression
 * @param {string} playerName - Player name
 * @param {Object} delta - Performance delta
 * @param {Object} quarterlyData - Quarterly progression data
 * @returns {string} - Narrative description
 */
export function generateProgressionNarrative(playerName, delta, quarterlyData) {
  const parts = [];
  
  // Overall trend
  if (quarterlyData.trend === 'improving') {
    parts.push(`${playerName} showed consistent improvement throughout the match.`);
  } else if (quarterlyData.trend === 'declining') {
    parts.push(`${playerName}'s performance declined as the match progressed.`);
  } else {
    parts.push(`${playerName} maintained consistent performance throughout the match.`);
  }
  
  // K/D change
  if (delta.kdDelta > 0.3) {
    parts.push(`K/D improved significantly (+${delta.kdDelta.toFixed(2)}) in the second half.`);
  } else if (delta.kdDelta < -0.3) {
    parts.push(`K/D dropped noticeably (${delta.kdDelta.toFixed(2)}) in the second half.`);
  }
  
  // Best quarter highlight
  if (quarterlyData.bestQuarter) {
    const best = quarterlyData.bestQuarter;
    parts.push(
      `Best performance in Q${best.quarter} (rounds ${best.startRound}-${best.endRound}) ` +
      `with ${best.performance.killsPerRound.toFixed(2)} kills/round.`
    );
  }
  
  return parts.join(' ');
}

export default {
  splitRoundsIntoHalves,
  calculatePerformanceInRounds,
  calculatePerformanceDelta,
  splitRoundsIntoQuarters,
  analyzeQuarterlyProgression,
  calculateTrendDirection,
  analyzeAllPlayersProgression,
  getPlayerProgressionReport,
  generateProgressionNarrative,
};




