/**
 * Analytics Module Index
 * 
 * Exports all analytics modules for convenient imports.
 * 
 * Structure:
 * - repository.js: Data access layer (operative)
 * - playerOps.js: Player statistics calculations (operative)
 * - roundOps.js: Round analysis functions (operative)
 * - progressionOps.js: Player progression analysis (operative)
 * - highlightOps.js: Highlight detection (operative)
 * - collective.js: Higher-level functions bundling operatives (collective)
 */

export { default as repository } from './repository.js';
export { default as playerOps } from './playerOps.js';
export { default as roundOps } from './roundOps.js';
export { default as progressionOps } from './progressionOps.js';
export { default as highlightOps } from './highlightOps.js';
export { default as collective } from './collective.js';

// Re-export key functions for convenience
export { 
  fetchMatchPlayers,
  fetchMatchRounds,
  fetchMatchEvents,
  fetchRoundEvents,
  fetchMatchKills,
  fetchMatchMetadata,
  matchExists,
} from './repository.js';

export {
  calculateMVPScore,
  findMatchMVP,
  findTeamMVPs,
  createPlayerStatsSummary,
  rankPlayersByMVP,
} from './playerOps.js';

export {
  findRoundMVP,
  analyzeRound,
  calculateMomentum,
  detectComebacks,
} from './roundOps.js';

export {
  analyzeAllPlayersProgression,
  getPlayerProgressionReport,
} from './progressionOps.js';

export {
  analyzeRoundHighlights,
  getTopHighlights,
  detectAces,
  detectClutch,
} from './highlightOps.js';

export {
  getMatchAnalytics,
  getMatchMVPs,
  getRoundMVPs,
  getMatchHighlights,
  getPlayerProgressions,
  getTeamAnalytics,
  getWeaponStats,
  getOpeningDuelStats,
  getTradeAnalysis,
} from './collective.js';





