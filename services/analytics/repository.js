/**
 * Match Analytics Data Repository
 * 
 * Operative functions for fetching raw match data from the database.
 * These functions are single-purpose data retrieval operations.
 */

import { Request, TYPES } from 'tedious';
import azureSqlConnection from '../../utils/azureSqlConnection.js';

// ============================================================================
// Database Execution Helper
// ============================================================================

function execute(query, parameters = []) {
  return new Promise((resolve, reject) => {
    const connection = azureSqlConnection.connect();

    connection.on('connect', err => {
      if (err) {
        connection.close();
        return reject(err);
      }

      const request = new Request(query, (requestErr, rowCount, rows) => {
        connection.close();
        if (requestErr) {
          return reject(requestErr);
        }
        return resolve({ rowCount, rows: rows || [] });
      });

      parameters.forEach(param => {
        request.addParameter(param.name, param.type, param.value);
      });

      connection.execSql(request);
    });

    connection.connect();
  });
}

function rowToObject(row) {
  return row.reduce((acc, column) => {
    acc[column.metadata.colName] = column.value;
    return acc;
  }, {});
}

function rowsToObjects(rows) {
  return rows.map(row => rowToObject(row));
}

// ============================================================================
// Operative Functions - Data Retrieval
// ============================================================================

/**
 * Fetch all players for a specific match
 * @param {string} matchId - Match ID
 * @returns {Promise<Array>} - Array of player objects
 */
export async function fetchMatchPlayers(matchId) {
  const { rows } = await execute(
    `SELECT * FROM [DemoMatchPlayers] WHERE [matchId] = @matchId ORDER BY [team], [kills] DESC`,
    [{ name: 'matchId', type: TYPES.NVarChar, value: matchId }]
  );
  
  return rowsToObjects(rows).map(player => ({
    id: player.id,
    matchId: player.matchId,
    steamId: player.steamId,
    playerName: player.playerName,
    team: player.team,
    kills: player.kills ?? 0,
    deaths: player.deaths ?? 0,
    assists: player.assists ?? 0,
    adr: player.adr ?? 0,
    headshotPercentage: player.headshotPercentage ?? 0,
    firstKills: player.firstKills ?? 0,
    firstDeaths: player.firstDeaths ?? 0,
    tradeKills: player.tradeKills ?? 0,
    clutchesWon: player.clutchesWon ?? 0,
    clutchesLost: player.clutchesLost ?? 0,
    utilityDamage: player.utilityDamage ?? 0,
    flashAssists: player.flashAssists ?? 0,
  }));
}

/**
 * Fetch all rounds for a specific match
 * @param {string} matchId - Match ID
 * @returns {Promise<Array>} - Array of round objects
 */
export async function fetchMatchRounds(matchId) {
  const { rows } = await execute(
    `SELECT * FROM [DemoMatchRounds] WHERE [matchId] = @matchId ORDER BY [roundNumber]`,
    [{ name: 'matchId', type: TYPES.NVarChar, value: matchId }]
  );
  
  return rowsToObjects(rows).map(round => ({
    id: round.id,
    matchId: round.matchId,
    roundNumber: round.roundNumber,
    winner: round.winner,
    winReason: round.winReason,
    ctScore: round.ctScore,
    tScore: round.tScore,
    durationSeconds: round.durationSeconds,
    startTick: round.startTick,
    endTick: round.endTick,
  }));
}

/**
 * Fetch all events for a specific match
 * @param {string} matchId - Match ID
 * @returns {Promise<Array>} - Array of event objects
 */
export async function fetchMatchEvents(matchId) {
  const { rows } = await execute(
    `SELECT * FROM [DemoRoundEvents] WHERE [matchId] = @matchId ORDER BY [roundNumber], [tick]`,
    [{ name: 'matchId', type: TYPES.NVarChar, value: matchId }]
  );
  
  return rowsToObjects(rows).map(event => ({
    id: event.id,
    matchId: event.matchId,
    roundId: event.roundId,
    roundNumber: event.roundNumber,
    eventType: event.eventType,
    tick: event.tick,
    attackerSteamId: event.attackerSteamId,
    victimSteamId: event.victimSteamId,
    assisterSteamId: event.assisterSteamId,
    weapon: event.weapon,
    isHeadshot: event.isHeadshot ?? false,
    isTradeKill: event.isTradeKill ?? false,
    positionX: event.positionX,
    positionY: event.positionY,
    positionZ: event.positionZ,
    eventData: event.eventData ? JSON.parse(event.eventData) : null,
  }));
}

/**
 * Fetch events for a specific round
 * @param {string} matchId - Match ID
 * @param {number} roundNumber - Round number
 * @returns {Promise<Array>} - Array of event objects for that round
 */
export async function fetchRoundEvents(matchId, roundNumber) {
  const { rows } = await execute(
    `SELECT * FROM [DemoRoundEvents] 
     WHERE [matchId] = @matchId AND [roundNumber] = @roundNumber 
     ORDER BY [tick]`,
    [
      { name: 'matchId', type: TYPES.NVarChar, value: matchId },
      { name: 'roundNumber', type: TYPES.Int, value: roundNumber }
    ]
  );
  
  return rowsToObjects(rows).map(event => ({
    id: event.id,
    matchId: event.matchId,
    roundId: event.roundId,
    roundNumber: event.roundNumber,
    eventType: event.eventType,
    tick: event.tick,
    attackerSteamId: event.attackerSteamId,
    victimSteamId: event.victimSteamId,
    assisterSteamId: event.assisterSteamId,
    weapon: event.weapon,
    isHeadshot: event.isHeadshot ?? false,
    isTradeKill: event.isTradeKill ?? false,
    positionX: event.positionX,
    positionY: event.positionY,
    positionZ: event.positionZ,
    eventData: event.eventData ? JSON.parse(event.eventData) : null,
  }));
}

/**
 * Fetch kill events for a specific match
 * @param {string} matchId - Match ID
 * @returns {Promise<Array>} - Array of kill events
 */
export async function fetchMatchKills(matchId) {
  const { rows } = await execute(
    `SELECT * FROM [DemoRoundEvents] 
     WHERE [matchId] = @matchId AND [eventType] = 'kill' 
     ORDER BY [roundNumber], [tick]`,
    [{ name: 'matchId', type: TYPES.NVarChar, value: matchId }]
  );
  
  return rowsToObjects(rows).map(event => ({
    id: event.id,
    roundNumber: event.roundNumber,
    tick: event.tick,
    attackerSteamId: event.attackerSteamId,
    victimSteamId: event.victimSteamId,
    assisterSteamId: event.assisterSteamId,
    weapon: event.weapon,
    isHeadshot: event.isHeadshot ?? false,
    isTradeKill: event.isTradeKill ?? false,
    positionX: event.positionX,
    positionY: event.positionY,
    positionZ: event.positionZ,
  }));
}

/**
 * Fetch match metadata
 * @param {string} matchId - Match ID
 * @returns {Promise<Object|null>} - Match metadata or null if not found
 */
export async function fetchMatchMetadata(matchId) {
  const { rows } = await execute(
    `SELECT [id], [map], [teams], [playedAt], [durationMinutes], [rounds] 
     FROM [DemoMatches] WHERE [id] = @matchId`,
    [{ name: 'matchId', type: TYPES.NVarChar, value: matchId }]
  );
  
  if (rows.length === 0) return null;
  
  const match = rowToObject(rows[0]);
  return {
    id: match.id,
    map: match.map,
    teams: match.teams ? JSON.parse(match.teams) : null,
    playedAt: match.playedAt ? match.playedAt.toISOString() : null,
    durationMinutes: match.durationMinutes,
    totalRounds: match.rounds,
  };
}

/**
 * Check if match exists
 * @param {string} matchId - Match ID
 * @returns {Promise<boolean>}
 */
export async function matchExists(matchId) {
  const { rows } = await execute(
    `SELECT 1 FROM [DemoMatches] WHERE [id] = @matchId`,
    [{ name: 'matchId', type: TYPES.NVarChar, value: matchId }]
  );
  return rows.length > 0;
}

export default {
  fetchMatchPlayers,
  fetchMatchRounds,
  fetchMatchEvents,
  fetchRoundEvents,
  fetchMatchKills,
  fetchMatchMetadata,
  matchExists,
};





