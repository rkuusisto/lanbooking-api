/**
 * Collective Analytics Functions
 * 
 * Higher-level functions that orchestrate multiple operative functions
 * to produce comprehensive analytics results. These are the main
 * entry points for the analytics API.
 */

import repository from './repository.js';
import playerOps from './playerOps.js';
import roundOps from './roundOps.js';
import progressionOps from './progressionOps.js';
import highlightOps from './highlightOps.js';

// ============================================================================
// Collective Functions - Match Overview
// ============================================================================

/**
 * Get complete match analytics summary
 * Bundles: match metadata, player stats, round summary, and top highlights
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - Complete match analytics
 */
export async function getMatchAnalytics(matchId) {
  // Fetch all raw data in parallel
  const [metadata, players, rounds, events] = await Promise.all([
    repository.fetchMatchMetadata(matchId),
    repository.fetchMatchPlayers(matchId),
    repository.fetchMatchRounds(matchId),
    repository.fetchMatchEvents(matchId),
  ]);

  if (!metadata) {
    return null;
  }

  const totalRounds = rounds.length;

  // Calculate player stats with MVP scores
  const playerStats = players.map(player => 
    playerOps.createPlayerStatsSummary(player, totalRounds)
  );

  // Find MVPs
  const matchMVP = playerOps.findMatchMVP(players, totalRounds);
  const teamMVPs = playerOps.findTeamMVPs(players, totalRounds);

  // Calculate momentum
  const momentum = roundOps.calculateMomentum(rounds);
  const winStreaks = roundOps.calculateWinStreaks(rounds);
  const comebacks = roundOps.detectComebacks(rounds);

  // Get progression analysis
  const progression = progressionOps.analyzeAllPlayersProgression(players, events, rounds);

  // Get highlights
  const roundHighlights = await collectAllRoundHighlights(matchId, rounds, events, players);
  const topHighlights = highlightOps.getTopHighlights(roundHighlights, 10);

  return {
    matchId: metadata.id,
    map: metadata.map,
    teams: metadata.teams,
    playedAt: metadata.playedAt,
    durationMinutes: metadata.durationMinutes,
    totalRounds,
    
    finalScore: {
      CT: rounds.length > 0 ? rounds[rounds.length - 1].ctScore : 0,
      T: rounds.length > 0 ? rounds[rounds.length - 1].tScore : 0,
    },

    mvp: {
      match: matchMVP,
      teams: teamMVPs,
    },

    playerStats: playerStats.sort((a, b) => b.mvpScore - a.mvpScore),

    progression: {
      mostImproved: progression.mostImproved ? {
        steamId: progression.mostImproved.steamId,
        playerName: progression.mostImproved.playerName,
        team: progression.mostImproved.team,
        improvementScore: Math.round(progression.mostImproved.improvementScore * 100) / 100,
        firstHalfKD: progression.mostImproved.firstHalf.kd,
        secondHalfKD: progression.mostImproved.secondHalf.kd,
      } : null,
      mostDeclined: progression.mostDeclined ? {
        steamId: progression.mostDeclined.steamId,
        playerName: progression.mostDeclined.playerName,
        team: progression.mostDeclined.team,
        improvementScore: Math.round(progression.mostDeclined.improvementScore * 100) / 100,
        firstHalfKD: progression.mostDeclined.firstHalf.kd,
        secondHalfKD: progression.mostDeclined.secondHalf.kd,
      } : null,
    },

    momentum: {
      winStreaks,
      comebacks,
      swings: momentum.filter(m => Math.abs(m.momentum) >= 2),
    },

    highlights: topHighlights,
    
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Collective Functions - MVP Analysis
// ============================================================================

/**
 * Get all MVP data for a match
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - MVP analysis
 */
export async function getMatchMVPs(matchId) {
  const [players, rounds, events] = await Promise.all([
    repository.fetchMatchPlayers(matchId),
    repository.fetchMatchRounds(matchId),
    repository.fetchMatchEvents(matchId),
  ]);

  if (players.length === 0) {
    return null;
  }

  const totalRounds = rounds.length;

  // Match MVP
  const matchMVP = playerOps.findMatchMVP(players, totalRounds);

  // Team MVPs
  const teamMVPs = playerOps.findTeamMVPs(players, totalRounds);

  // Round MVPs
  const roundMVPs = [];
  for (const round of rounds) {
    const roundEvents = events.filter(e => e.roundNumber === round.roundNumber);
    const roundMVP = roundOps.findRoundMVP(players, roundEvents, round);
    if (roundMVP) {
      roundMVPs.push(roundMVP);
    }
  }

  // Count round MVPs per player
  const mvpCounts = {};
  roundMVPs.forEach(mvp => {
    if (!mvpCounts[mvp.steamId]) {
      mvpCounts[mvp.steamId] = {
        steamId: mvp.steamId,
        playerName: mvp.playerName,
        team: mvp.team,
        count: 0,
        rounds: [],
      };
    }
    mvpCounts[mvp.steamId].count++;
    mvpCounts[mvp.steamId].rounds.push(mvp.roundNumber);
  });

  const mvpLeaderboard = Object.values(mvpCounts)
    .sort((a, b) => b.count - a.count);

  return {
    matchMVP,
    teamMVPs,
    roundMVPs,
    mvpLeaderboard,
  };
}

/**
 * Get round-by-round MVP breakdown
 * @param {string} matchId - Match ID
 * @returns {Promise<Array>} - Round MVPs
 */
export async function getRoundMVPs(matchId) {
  const [players, rounds, events] = await Promise.all([
    repository.fetchMatchPlayers(matchId),
    repository.fetchMatchRounds(matchId),
    repository.fetchMatchEvents(matchId),
  ]);

  const roundMVPs = [];
  
  for (const round of rounds) {
    const roundEvents = events.filter(e => e.roundNumber === round.roundNumber);
    const analysis = roundOps.analyzeRound(round, roundEvents, players);
    roundMVPs.push(analysis);
  }

  return roundMVPs;
}

// ============================================================================
// Collective Functions - Highlights
// ============================================================================

/**
 * Collect all highlights from all rounds
 * @param {string} matchId - Match ID
 * @param {Array} rounds - Rounds (optional, fetched if not provided)
 * @param {Array} events - Events (optional, fetched if not provided)
 * @param {Array} players - Players (optional, fetched if not provided)
 * @returns {Promise<Array>} - All round highlights
 */
export async function collectAllRoundHighlights(matchId, rounds = null, events = null, players = null) {
  // Fetch data if not provided
  if (!rounds || !events || !players) {
    [players, rounds, events] = await Promise.all([
      players || repository.fetchMatchPlayers(matchId),
      rounds || repository.fetchMatchRounds(matchId),
      events || repository.fetchMatchEvents(matchId),
    ]);
  }

  const allHighlights = [];
  
  for (const round of rounds) {
    const roundEvents = events.filter(e => e.roundNumber === round.roundNumber);
    const highlights = highlightOps.analyzeRoundHighlights(round, roundEvents, players);
    allHighlights.push(highlights);
  }

  return allHighlights;
}

/**
 * Get top match highlights
 * @param {string} matchId - Match ID
 * @param {number} limit - Maximum number of highlights
 * @returns {Promise<Object>} - Highlights summary
 */
export async function getMatchHighlights(matchId, limit = 15) {
  const [players, rounds, events] = await Promise.all([
    repository.fetchMatchPlayers(matchId),
    repository.fetchMatchRounds(matchId),
    repository.fetchMatchEvents(matchId),
  ]);

  const allRoundHighlights = await collectAllRoundHighlights(matchId, rounds, events, players);
  const topHighlights = highlightOps.getTopHighlights(allRoundHighlights, limit);

  // Categorize highlights
  const byType = {
    aces: topHighlights.filter(h => h.type === 'ace'),
    clutches: topHighlights.filter(h => h.type === 'clutch'),
    multiKills: topHighlights.filter(h => ['triple_kill', 'quad_kill'].includes(h.type)),
    ninjaDefuses: topHighlights.filter(h => h.type === 'ninja_defuse'),
  };

  // Count highlights per player
  const playerHighlightCounts = {};
  topHighlights.forEach(h => {
    const key = h.steamId || 'unknown';
    if (!playerHighlightCounts[key]) {
      playerHighlightCounts[key] = {
        steamId: h.steamId,
        playerName: h.playerName,
        team: h.team,
        count: 0,
      };
    }
    playerHighlightCounts[key].count++;
  });

  return {
    topHighlights,
    byType,
    playerHighlightCounts: Object.values(playerHighlightCounts)
      .sort((a, b) => b.count - a.count),
    totalHighlights: topHighlights.length,
  };
}

// ============================================================================
// Collective Functions - Player Progression
// ============================================================================

/**
 * Get player progression analysis for all players
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - Progression analysis
 */
export async function getPlayerProgressions(matchId) {
  const [players, rounds, events] = await Promise.all([
    repository.fetchMatchPlayers(matchId),
    repository.fetchMatchRounds(matchId),
    repository.fetchMatchEvents(matchId),
  ]);

  if (players.length === 0) {
    return null;
  }

  const analysis = progressionOps.analyzeAllPlayersProgression(players, events, rounds);

  // Get detailed reports for top and bottom players
  const mostImprovedReport = analysis.mostImproved 
    ? progressionOps.getPlayerProgressionReport(
        players.find(p => p.steamId === analysis.mostImproved.steamId),
        events,
        rounds
      )
    : null;

  const mostDeclinedReport = analysis.mostDeclined
    ? progressionOps.getPlayerProgressionReport(
        players.find(p => p.steamId === analysis.mostDeclined.steamId),
        events,
        rounds
      )
    : null;

  return {
    mostImproved: mostImprovedReport,
    mostDeclined: mostDeclinedReport,
    rankings: analysis.rankings,
    summary: {
      totalPlayers: players.length,
      improvedPlayers: analysis.allPlayers.filter(p => p.improvementScore > 5).length,
      declinedPlayers: analysis.allPlayers.filter(p => p.improvementScore < -5).length,
      stablePlayers: analysis.allPlayers.filter(p => 
        p.improvementScore >= -5 && p.improvementScore <= 5
      ).length,
    },
  };
}

/**
 * Get progression report for a specific player
 * @param {string} matchId - Match ID
 * @param {string} steamId - Player's Steam ID
 * @returns {Promise<Object>} - Player progression report
 */
export async function getPlayerProgressionReport(matchId, steamId) {
  const [players, rounds, events] = await Promise.all([
    repository.fetchMatchPlayers(matchId),
    repository.fetchMatchRounds(matchId),
    repository.fetchMatchEvents(matchId),
  ]);

  const player = players.find(p => p.steamId === steamId);
  if (!player) {
    return null;
  }

  return progressionOps.getPlayerProgressionReport(player, events, rounds);
}

// ============================================================================
// Collective Functions - Team Analysis
// ============================================================================

/**
 * Get team-based analytics
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - Team analytics
 */
export async function getTeamAnalytics(matchId) {
  const [metadata, players, rounds, events] = await Promise.all([
    repository.fetchMatchMetadata(matchId),
    repository.fetchMatchPlayers(matchId),
    repository.fetchMatchRounds(matchId),
    repository.fetchMatchEvents(matchId),
  ]);

  if (!metadata) {
    return null;
  }

  const totalRounds = rounds.length;
  const ctPlayers = players.filter(p => p.team === 'CT');
  const tPlayers = players.filter(p => p.team === 'T');

  // Calculate team totals
  const calculateTeamStats = (teamPlayers) => {
    const stats = {
      totalKills: 0,
      totalDeaths: 0,
      totalAssists: 0,
      avgADR: 0,
      avgHeadshotPct: 0,
      totalFirstKills: 0,
      totalClutchesWon: 0,
    };

    teamPlayers.forEach(p => {
      stats.totalKills += p.kills;
      stats.totalDeaths += p.deaths;
      stats.totalAssists += p.assists;
      stats.avgADR += p.adr;
      stats.avgHeadshotPct += p.headshotPercentage;
      stats.totalFirstKills += p.firstKills;
      stats.totalClutchesWon += p.clutchesWon;
    });

    if (teamPlayers.length > 0) {
      stats.avgADR = Math.round(stats.avgADR / teamPlayers.length);
      stats.avgHeadshotPct = Math.round(stats.avgHeadshotPct / teamPlayers.length);
    }

    return stats;
  };

  const ctStats = calculateTeamStats(ctPlayers);
  const tStats = calculateTeamStats(tPlayers);

  // Calculate round wins by side
  const ctRoundWins = rounds.filter(r => r.winner === 'CT').length;
  const tRoundWins = rounds.filter(r => r.winner === 'T').length;

  // Win reasons breakdown
  const winReasons = { CT: {}, T: {} };
  rounds.forEach(r => {
    if (!winReasons[r.winner][r.winReason]) {
      winReasons[r.winner][r.winReason] = 0;
    }
    winReasons[r.winner][r.winReason]++;
  });

  return {
    teams: metadata.teams,
    CT: {
      players: ctPlayers.length,
      stats: ctStats,
      roundsWon: ctRoundWins,
      winReasons: winReasons.CT,
      mvp: playerOps.findMatchMVP(ctPlayers, totalRounds),
    },
    T: {
      players: tPlayers.length,
      stats: tStats,
      roundsWon: tRoundWins,
      winReasons: winReasons.T,
      mvp: playerOps.findMatchMVP(tPlayers, totalRounds),
    },
    comparison: {
      killDiff: ctStats.totalKills - tStats.totalKills,
      adrDiff: ctStats.avgADR - tStats.avgADR,
      roundDiff: ctRoundWins - tRoundWins,
    },
  };
}

// ============================================================================
// Collective Functions - Weapon Statistics
// ============================================================================

/**
 * Get weapon usage statistics for the match
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - Weapon statistics
 */
export async function getWeaponStats(matchId) {
  const [players, events] = await Promise.all([
    repository.fetchMatchPlayers(matchId),
    repository.fetchMatchEvents(matchId),
  ]);

  const killEvents = events.filter(e => e.eventType === 'kill');
  
  const weaponStats = {};
  const playerWeaponStats = {};

  killEvents.forEach(kill => {
    const weapon = kill.weapon || 'unknown';
    
    // Global weapon stats
    if (!weaponStats[weapon]) {
      weaponStats[weapon] = {
        weapon,
        kills: 0,
        headshots: 0,
        headshotRate: 0,
      };
    }
    weaponStats[weapon].kills++;
    if (kill.isHeadshot) weaponStats[weapon].headshots++;

    // Player weapon stats
    const steamId = kill.attackerSteamId;
    if (!playerWeaponStats[steamId]) {
      playerWeaponStats[steamId] = {};
    }
    if (!playerWeaponStats[steamId][weapon]) {
      playerWeaponStats[steamId][weapon] = { kills: 0, headshots: 0 };
    }
    playerWeaponStats[steamId][weapon].kills++;
    if (kill.isHeadshot) playerWeaponStats[steamId][weapon].headshots++;
  });

  // Calculate headshot rates
  Object.values(weaponStats).forEach(ws => {
    ws.headshotRate = ws.kills > 0 
      ? Math.round((ws.headshots / ws.kills) * 100) 
      : 0;
  });

  // Find favorite weapons per player
  const playerFavorites = players.map(player => {
    const weapons = playerWeaponStats[player.steamId] || {};
    const sorted = Object.entries(weapons)
      .map(([weapon, stats]) => ({ weapon, ...stats }))
      .sort((a, b) => b.kills - a.kills);
    
    return {
      steamId: player.steamId,
      playerName: player.playerName,
      team: player.team,
      favoriteWeapon: sorted[0]?.weapon || 'none',
      favoriteWeaponKills: sorted[0]?.kills || 0,
      weaponBreakdown: sorted.slice(0, 3),
    };
  });

  return {
    overview: Object.values(weaponStats)
      .sort((a, b) => b.kills - a.kills),
    playerFavorites,
    mostDeadlyWeapon: Object.values(weaponStats)
      .sort((a, b) => b.kills - a.kills)[0] || null,
    highestHSRateWeapon: Object.values(weaponStats)
      .filter(w => w.kills >= 5)
      .sort((a, b) => b.headshotRate - a.headshotRate)[0] || null,
  };
}

// ============================================================================
// Collective Functions - Additional Suggested Analytics
// ============================================================================

/**
 * Get opening duel statistics
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - Opening duel stats
 */
export async function getOpeningDuelStats(matchId) {
  const [players, rounds, events] = await Promise.all([
    repository.fetchMatchPlayers(matchId),
    repository.fetchMatchRounds(matchId),
    repository.fetchMatchEvents(matchId),
  ]);

  const openingDuels = [];

  rounds.forEach(round => {
    const roundEvents = events.filter(e => 
      e.roundNumber === round.roundNumber && e.eventType === 'kill'
    );
    
    if (roundEvents.length > 0) {
      const firstKill = roundEvents.sort((a, b) => a.tick - b.tick)[0];
      const attacker = players.find(p => p.steamId === firstKill.attackerSteamId);
      const victim = players.find(p => p.steamId === firstKill.victimSteamId);
      
      openingDuels.push({
        roundNumber: round.roundNumber,
        winner: attacker?.team,
        roundWinner: round.winner,
        wasConvertedToRoundWin: attacker?.team === round.winner,
        attackerSteamId: firstKill.attackerSteamId,
        attackerName: attacker?.playerName || 'Unknown',
        victimSteamId: firstKill.victimSteamId,
        victimName: victim?.playerName || 'Unknown',
        weapon: firstKill.weapon,
      });
    }
  });

  // Calculate conversion rates
  const ctOpening = openingDuels.filter(d => d.winner === 'CT');
  const tOpening = openingDuels.filter(d => d.winner === 'T');

  const ctConversions = ctOpening.filter(d => d.wasConvertedToRoundWin).length;
  const tConversions = tOpening.filter(d => d.wasConvertedToRoundWin).length;

  // Player opening duel stats
  const playerOpeningStats = {};
  openingDuels.forEach(duel => {
    // Winner stats
    if (!playerOpeningStats[duel.attackerSteamId]) {
      playerOpeningStats[duel.attackerSteamId] = {
        wins: 0, losses: 0, conversions: 0,
        name: duel.attackerName,
      };
    }
    playerOpeningStats[duel.attackerSteamId].wins++;
    if (duel.wasConvertedToRoundWin) {
      playerOpeningStats[duel.attackerSteamId].conversions++;
    }

    // Loser stats
    if (!playerOpeningStats[duel.victimSteamId]) {
      playerOpeningStats[duel.victimSteamId] = {
        wins: 0, losses: 0, conversions: 0,
        name: duel.victimName,
      };
    }
    playerOpeningStats[duel.victimSteamId].losses++;
  });

  const playerStats = Object.entries(playerOpeningStats).map(([steamId, stats]) => ({
    steamId,
    playerName: stats.name,
    openingWins: stats.wins,
    openingLosses: stats.losses,
    openingRating: stats.wins + stats.losses > 0
      ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100)
      : 0,
    conversions: stats.conversions,
  })).sort((a, b) => b.openingRating - a.openingRating);

  return {
    totalOpeningDuels: openingDuels.length,
    team: {
      CT: {
        openingWins: ctOpening.length,
        conversions: ctConversions,
        conversionRate: ctOpening.length > 0 
          ? Math.round((ctConversions / ctOpening.length) * 100) 
          : 0,
      },
      T: {
        openingWins: tOpening.length,
        conversions: tConversions,
        conversionRate: tOpening.length > 0 
          ? Math.round((tConversions / tOpening.length) * 100) 
          : 0,
      },
    },
    playerStats,
    bestOpener: playerStats[0] || null,
    duels: openingDuels,
  };
}

/**
 * Get trade kill analysis
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - Trade kill statistics
 */
export async function getTradeAnalysis(matchId) {
  const [players, events] = await Promise.all([
    repository.fetchMatchPlayers(matchId),
    repository.fetchMatchEvents(matchId),
  ]);

  const killEvents = events.filter(e => e.eventType === 'kill');
  const tradeKills = killEvents.filter(e => e.isTradeKill);

  // Calculate trade stats per team
  const ctTrades = tradeKills.filter(k => {
    const attacker = players.find(p => p.steamId === k.attackerSteamId);
    return attacker?.team === 'CT';
  });

  const tTrades = tradeKills.filter(k => {
    const attacker = players.find(p => p.steamId === k.attackerSteamId);
    return attacker?.team === 'T';
  });

  // Player trade stats
  const playerTradeStats = players.map(player => ({
    steamId: player.steamId,
    playerName: player.playerName,
    team: player.team,
    tradeKills: player.tradeKills,
    deathsTraded: tradeKills.filter(k => k.victimSteamId === player.steamId).length,
  }));

  return {
    totalTradeKills: tradeKills.length,
    tradeKillPercentage: killEvents.length > 0
      ? Math.round((tradeKills.length / killEvents.length) * 100)
      : 0,
    team: {
      CT: {
        tradeKills: ctTrades.length,
        percentage: killEvents.filter(k => {
          const a = players.find(p => p.steamId === k.attackerSteamId);
          return a?.team === 'CT';
        }).length > 0
          ? Math.round((ctTrades.length / killEvents.filter(k => {
              const a = players.find(p => p.steamId === k.attackerSteamId);
              return a?.team === 'CT';
            }).length) * 100)
          : 0,
      },
      T: {
        tradeKills: tTrades.length,
        percentage: killEvents.filter(k => {
          const a = players.find(p => p.steamId === k.attackerSteamId);
          return a?.team === 'T';
        }).length > 0
          ? Math.round((tTrades.length / killEvents.filter(k => {
              const a = players.find(p => p.steamId === k.attackerSteamId);
              return a?.team === 'T';
            }).length) * 100)
          : 0,
      },
    },
    playerStats: playerTradeStats.sort((a, b) => b.tradeKills - a.tradeKills),
    bestTrader: playerTradeStats.sort((a, b) => b.tradeKills - a.tradeKills)[0] || null,
  };
}

export default {
  getMatchAnalytics,
  getMatchMVPs,
  getRoundMVPs,
  collectAllRoundHighlights,
  getMatchHighlights,
  getPlayerProgressions,
  getPlayerProgressionReport,
  getTeamAnalytics,
  getWeaponStats,
  getOpeningDuelStats,
  getTradeAnalysis,
};




