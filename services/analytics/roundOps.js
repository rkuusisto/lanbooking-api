/**
 * Round Analytics Operative Functions
 * 
 * Single-purpose calculation functions for round-based analysis.
 */

// ============================================================================
// Round Player Performance
// ============================================================================

/**
 * Calculate player stats for a specific round from events
 * @param {string} steamId - Player's Steam ID
 * @param {Array} events - Events for the round
 * @returns {Object} - Player's round stats
 */
export function calculatePlayerRoundStats(steamId, events) {
  const stats = {
    kills: 0,
    deaths: 0,
    assists: 0,
    headshots: 0,
    tradeKills: 0,
    flashAssists: 0,
    damageEvents: 0,
    openingKill: false,
    openingDeath: false,
    clutchWin: false,
  };

  const killEvents = events.filter(e => e.eventType === 'kill');
  
  killEvents.forEach((event, index) => {
    if (event.attackerSteamId === steamId) {
      stats.kills++;
      if (event.isHeadshot) stats.headshots++;
      if (event.isTradeKill) stats.tradeKills++;
      if (index === 0) stats.openingKill = true;
    }
    
    if (event.victimSteamId === steamId) {
      stats.deaths++;
      if (index === 0) stats.openingDeath = true;
    }
    
    if (event.assisterSteamId === steamId) {
      stats.assists++;
    }
  });

  // Count flash assists
  const flashEvents = events.filter(e => e.eventType === 'flash');
  flashEvents.forEach(event => {
    if (event.attackerSteamId === steamId) {
      stats.flashAssists++;
    }
  });

  return stats;
}

/**
 * Calculate MVP score for a round
 * @param {Object} roundStats - Player's round stats
 * @returns {number} - Round MVP score
 */
export function calculateRoundMVPScore(roundStats) {
  let score = 0;
  
  // Kills are worth a lot
  score += roundStats.kills * 30;
  
  // Headshots bonus
  score += roundStats.headshots * 5;
  
  // Opening kill is very valuable
  if (roundStats.openingKill) score += 25;
  
  // Trade kills are valuable
  score += roundStats.tradeKills * 10;
  
  // Assists contribute
  score += roundStats.assists * 10;
  
  // Flash assists
  score += roundStats.flashAssists * 5;
  
  // Clutch win is huge
  if (roundStats.clutchWin) score += 50;
  
  // Deaths reduce score
  score -= roundStats.deaths * 10;
  
  // Opening death is bad
  if (roundStats.openingDeath) score -= 15;
  
  return Math.max(0, score);
}

/**
 * Find the MVP for a specific round
 * @param {Array} players - All players in the match
 * @param {Array} events - Events for the round
 * @param {Object} round - Round data
 * @returns {Object} - Round MVP with stats
 */
export function findRoundMVP(players, events, round) {
  if (events.length === 0) {
    return null;
  }

  const playerScores = players.map(player => {
    const roundStats = calculatePlayerRoundStats(player.steamId, events);
    const mvpScore = calculateRoundMVPScore(roundStats);
    
    return {
      steamId: player.steamId,
      playerName: player.playerName,
      team: player.team,
      roundNumber: round.roundNumber,
      kills: roundStats.kills,
      deaths: roundStats.deaths,
      assists: roundStats.assists,
      headshots: roundStats.headshots,
      openingKill: roundStats.openingKill,
      tradeKills: roundStats.tradeKills,
      mvpScore,
    };
  });

  // Sort by MVP score descending
  playerScores.sort((a, b) => b.mvpScore - a.mvpScore);
  
  // Return the top scorer (if they contributed)
  const topScorer = playerScores[0];
  if (topScorer && topScorer.mvpScore > 0) {
    return topScorer;
  }
  
  return null;
}

// ============================================================================
// Round Analysis
// ============================================================================

/**
 * Analyze a round for key events
 * @param {Object} round - Round data
 * @param {Array} events - Events for the round
 * @param {Array} players - All players
 * @returns {Object} - Round analysis
 */
export function analyzeRound(round, events, players) {
  const killEvents = events.filter(e => e.eventType === 'kill');
  
  const analysis = {
    roundNumber: round.roundNumber,
    winner: round.winner,
    winReason: round.winReason,
    scoreCT: round.ctScore,
    scoreT: round.tScore,
    totalKills: killEvents.length,
    headshots: killEvents.filter(e => e.isHeadshot).length,
    tradeKills: killEvents.filter(e => e.isTradeKill).length,
    weapons: {},
    mvp: findRoundMVP(players, events, round),
  };

  // Count weapon usage
  killEvents.forEach(event => {
    if (event.weapon) {
      analysis.weapons[event.weapon] = (analysis.weapons[event.weapon] || 0) + 1;
    }
  });

  return analysis;
}

/**
 * Calculate round momentum (score differential changes)
 * @param {Array} rounds - All rounds
 * @returns {Array} - Momentum data per round
 */
export function calculateMomentum(rounds) {
  return rounds.map((round, index) => {
    const scoreDiff = round.ctScore - round.tScore;
    const prevDiff = index > 0 
      ? rounds[index - 1].ctScore - rounds[index - 1].tScore 
      : 0;
    
    return {
      roundNumber: round.roundNumber,
      ctScore: round.ctScore,
      tScore: round.tScore,
      scoreDiff,
      momentum: scoreDiff - prevDiff, // Positive = CT gaining, Negative = T gaining
      winner: round.winner,
      winReason: round.winReason,
    };
  });
}

/**
 * Detect comeback scenarios
 * @param {Array} rounds - All rounds
 * @returns {Array} - Comeback events
 */
export function detectComebacks(rounds) {
  const comebacks = [];
  let ctMaxDeficit = 0;
  let tMaxDeficit = 0;
  
  rounds.forEach((round, index) => {
    const diff = round.ctScore - round.tScore;
    
    // Track maximum deficits
    if (diff < 0) {
      ctMaxDeficit = Math.max(ctMaxDeficit, Math.abs(diff));
    }
    if (diff > 0) {
      tMaxDeficit = Math.max(tMaxDeficit, diff);
    }
    
    // Check if a team came back from 5+ round deficit
    if (index > 0) {
      const prevDiff = rounds[index - 1].ctScore - rounds[index - 1].tScore;
      
      // CT comeback check
      if (prevDiff <= -5 && diff >= 0) {
        comebacks.push({
          team: 'CT',
          roundNumber: round.roundNumber,
          deficit: Math.abs(prevDiff),
          newLead: diff,
        });
      }
      
      // T comeback check
      if (prevDiff >= 5 && diff <= 0) {
        comebacks.push({
          team: 'T',
          roundNumber: round.roundNumber,
          deficit: prevDiff,
          newLead: Math.abs(diff),
        });
      }
    }
  });
  
  return comebacks;
}

/**
 * Calculate win streaks for each team
 * @param {Array} rounds - All rounds
 * @returns {Object} - Win streak data
 */
export function calculateWinStreaks(rounds) {
  let currentStreak = { team: null, count: 0 };
  const streaks = { CT: { max: 0, total: 0 }, T: { max: 0, total: 0 } };
  const allStreaks = [];
  
  rounds.forEach((round, index) => {
    if (currentStreak.team === round.winner) {
      currentStreak.count++;
    } else {
      // Save previous streak
      if (currentStreak.team && currentStreak.count >= 3) {
        allStreaks.push({
          team: currentStreak.team,
          length: currentStreak.count,
          startRound: round.roundNumber - currentStreak.count,
        });
      }
      
      // Track max for this team
      if (currentStreak.team) {
        streaks[currentStreak.team].max = Math.max(
          streaks[currentStreak.team].max, 
          currentStreak.count
        );
      }
      
      // Start new streak
      currentStreak = { team: round.winner, count: 1 };
    }
    
    // Count total rounds won
    streaks[round.winner].total++;
  });
  
  // Don't forget the last streak
  if (currentStreak.team) {
    streaks[currentStreak.team].max = Math.max(
      streaks[currentStreak.team].max, 
      currentStreak.count
    );
    if (currentStreak.count >= 3) {
      allStreaks.push({
        team: currentStreak.team,
        length: currentStreak.count,
        startRound: rounds.length - currentStreak.count + 1,
      });
    }
  }
  
  return {
    CT: streaks.CT,
    T: streaks.T,
    notableStreaks: allStreaks.filter(s => s.length >= 3),
  };
}

export default {
  calculatePlayerRoundStats,
  calculateRoundMVPScore,
  findRoundMVP,
  analyzeRound,
  calculateMomentum,
  detectComebacks,
  calculateWinStreaks,
};





