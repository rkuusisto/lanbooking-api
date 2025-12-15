/**
 * Player Analytics Operative Functions
 * 
 * Single-purpose calculation functions for player statistics.
 * These functions take raw data and perform specific calculations.
 */

// ============================================================================
// Performance Metrics
// ============================================================================

/**
 * Calculate Impact Rating for a player
 * Impact Rating = (Kills + 0.75 * Assists + 2 * ClutchesWon - 0.5 * Deaths) / TotalRounds
 * @param {Object} player - Player object with stats
 * @param {number} totalRounds - Total rounds in the match
 * @returns {number} - Impact rating (higher is better)
 */
export function calculateImpactRating(player, totalRounds) {
  if (totalRounds === 0) return 0;
  
  const impactScore = 
    player.kills + 
    (0.75 * player.assists) + 
    (2 * player.clutchesWon) - 
    (0.5 * player.deaths);
  
  return Math.round((impactScore / totalRounds) * 100) / 100;
}

/**
 * Calculate KAST (Kill/Assist/Survived/Trade) percentage
 * @param {Object} player - Player object
 * @param {number} totalRounds - Total rounds
 * @returns {number} - KAST percentage (0-100)
 */
export function calculateKAST(player, totalRounds) {
  if (totalRounds === 0) return 0;
  
  // Approximate KAST from available stats
  // Rounds with contribution = kills + assists + trade kills + survival bonus
  const contributionRounds = Math.min(
    player.kills + player.assists + player.tradeKills,
    totalRounds
  );
  
  return Math.round((contributionRounds / totalRounds) * 100);
}

/**
 * Calculate Kill/Death ratio
 * @param {Object} player - Player object
 * @returns {number} - K/D ratio
 */
export function calculateKD(player) {
  if (player.deaths === 0) return player.kills;
  return Math.round((player.kills / player.deaths) * 100) / 100;
}

/**
 * Calculate Kill/Death difference
 * @param {Object} player - Player object
 * @returns {number} - K/D difference (+ is good, - is bad)
 */
export function calculateKDDiff(player) {
  return player.kills - player.deaths;
}

/**
 * Calculate Opening Duel Success Rate
 * @param {Object} player - Player object
 * @returns {number} - Opening duel success percentage
 */
export function calculateOpeningDuelSuccess(player) {
  const totalOpeningDuels = player.firstKills + player.firstDeaths;
  if (totalOpeningDuels === 0) return 0;
  return Math.round((player.firstKills / totalOpeningDuels) * 100);
}

/**
 * Calculate Clutch Success Rate
 * @param {Object} player - Player object
 * @returns {number} - Clutch success percentage
 */
export function calculateClutchSuccess(player) {
  const totalClutches = player.clutchesWon + player.clutchesLost;
  if (totalClutches === 0) return 0;
  return Math.round((player.clutchesWon / totalClutches) * 100);
}

/**
 * Calculate Utility Efficiency (damage per flash assist)
 * @param {Object} player - Player object
 * @returns {number} - Utility efficiency score
 */
export function calculateUtilityEfficiency(player) {
  const utilityContribution = player.utilityDamage + (player.flashAssists * 20);
  return Math.round(utilityContribution);
}

// ============================================================================
// Composite Scores
// ============================================================================

/**
 * Calculate comprehensive MVP Score for a player
 * Weighted combination of all performance metrics
 * @param {Object} player - Player object
 * @param {number} totalRounds - Total rounds
 * @returns {number} - MVP score (0-100+ scale)
 */
export function calculateMVPScore(player, totalRounds) {
  const weights = {
    adr: 0.25,        // Damage is king
    kd: 0.15,         // Kill efficiency
    impact: 0.20,     // Overall impact
    openings: 0.15,   // Entry/opening importance
    clutch: 0.10,     // Clutch factor
    utility: 0.10,    // Utility usage
    headshots: 0.05,  // Aim skill indicator
  };

  // Normalize each metric to a 0-100 scale
  const adrScore = Math.min((player.adr / 1.2), 100); // 120 ADR = 100 score
  const kdScore = Math.min((calculateKD(player) / 2) * 100, 100); // 2.0 K/D = 100 score
  const impactScore = Math.min((calculateImpactRating(player, totalRounds) / 1.5) * 100, 100);
  const openingsScore = calculateOpeningDuelSuccess(player);
  const clutchScore = calculateClutchSuccess(player);
  const utilityScore = Math.min((calculateUtilityEfficiency(player) / 150) * 100, 100);
  const headshotScore = Math.min(player.headshotPercentage * 2, 100); // 50% HS = 100 score

  const mvpScore = 
    (adrScore * weights.adr) +
    (kdScore * weights.kd) +
    (impactScore * weights.impact) +
    (openingsScore * weights.openings) +
    (clutchScore * weights.clutch) +
    (utilityScore * weights.utility) +
    (headshotScore * weights.headshots);

  return Math.round(mvpScore * 100) / 100;
}

/**
 * Create detailed player stats summary
 * @param {Object} player - Player object
 * @param {number} totalRounds - Total rounds
 * @returns {Object} - Comprehensive stats object
 */
export function createPlayerStatsSummary(player, totalRounds) {
  return {
    steamId: player.steamId,
    playerName: player.playerName,
    team: player.team,
    
    // Core stats
    kills: player.kills,
    deaths: player.deaths,
    assists: player.assists,
    adr: player.adr,
    headshotPercentage: player.headshotPercentage,
    
    // Calculated metrics
    kd: calculateKD(player),
    kdDiff: calculateKDDiff(player),
    impactRating: calculateImpactRating(player, totalRounds),
    kast: calculateKAST(player, totalRounds),
    
    // Opening duels
    firstKills: player.firstKills,
    firstDeaths: player.firstDeaths,
    openingDuelSuccess: calculateOpeningDuelSuccess(player),
    
    // Clutches
    clutchesWon: player.clutchesWon,
    clutchesLost: player.clutchesLost,
    clutchSuccess: calculateClutchSuccess(player),
    
    // Trades & Utility
    tradeKills: player.tradeKills,
    utilityDamage: player.utilityDamage,
    flashAssists: player.flashAssists,
    utilityEfficiency: calculateUtilityEfficiency(player),
    
    // MVP Score
    mvpScore: calculateMVPScore(player, totalRounds),
  };
}

// ============================================================================
// Ranking Functions
// ============================================================================

/**
 * Rank players by MVP score
 * @param {Array} players - Array of player objects
 * @param {number} totalRounds - Total rounds
 * @returns {Array} - Players sorted by MVP score (highest first)
 */
export function rankPlayersByMVP(players, totalRounds) {
  return players
    .map(player => ({
      ...player,
      mvpScore: calculateMVPScore(player, totalRounds),
    }))
    .sort((a, b) => b.mvpScore - a.mvpScore);
}

/**
 * Get the Match MVP
 * @param {Array} players - Array of player objects
 * @param {number} totalRounds - Total rounds
 * @returns {Object} - Match MVP with full stats
 */
export function findMatchMVP(players, totalRounds) {
  const ranked = rankPlayersByMVP(players, totalRounds);
  if (ranked.length === 0) return null;
  
  const mvp = ranked[0];
  return createPlayerStatsSummary(mvp, totalRounds);
}

/**
 * Get team MVPs (one for each team)
 * @param {Array} players - Array of player objects
 * @param {number} totalRounds - Total rounds
 * @returns {Object} - Object with CT and T team MVPs
 */
export function findTeamMVPs(players, totalRounds) {
  const ctPlayers = players.filter(p => p.team === 'CT');
  const tPlayers = players.filter(p => p.team === 'T');
  
  return {
    CT: findMatchMVP(ctPlayers, totalRounds),
    T: findMatchMVP(tPlayers, totalRounds),
  };
}

export default {
  calculateImpactRating,
  calculateKAST,
  calculateKD,
  calculateKDDiff,
  calculateOpeningDuelSuccess,
  calculateClutchSuccess,
  calculateUtilityEfficiency,
  calculateMVPScore,
  createPlayerStatsSummary,
  rankPlayersByMVP,
  findMatchMVP,
  findTeamMVPs,
};





