import { Request, TYPES } from 'tedious';
import azureSqlConnection from '../utils/azureSqlConnection.js';

const TABLE = '[DemoMatches]';

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

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

/**
 * Format match date as dd-MM-yyyy_HH-mm-ss (filename-safe format)
 * @param {string|Date} dateInput - Date to format
 * @returns {string} - Formatted date string or empty string if invalid
 */
export const formatMatchDate = (dateInput) => {
  if (!dateInput) return '';

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
};

/**
 * Sanitize a string for safe use in filenames
 * Removes or replaces characters that could be dangerous in HTTP headers or filenames
 * Note: Most filesystems have a 255-byte limit for filenames. This function enforces that limit.
 * @param {string} str - String to sanitize
 * @param {number} maxLength - Maximum length in characters (default: 255 for most filesystems)
 * @returns {string} - Sanitized string, truncated to maxLength if necessary
 */
export const sanitizeFilenameComponent = (str, maxLength = 255) => {
  if (!str || typeof str !== 'string') {
    return '';
  }

  const sanitized = str
    // Remove control characters (0x00-0x1F, 0x7F-0x9F)
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    // Remove characters that are problematic in HTTP headers
    .replace(/["\\]/g, '')
    // Remove newlines and carriage returns (defense in depth)
    .replace(/[\r\n]/g, '')
    // Replace path separators with underscores
    .replace(/[/\\]/g, '_')
    // Remove other potentially dangerous characters
    .replace(/[<>:|?*]/g, '')
    // Trim whitespace
    .trim()
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ');

  // Enforce length limit (most filesystems have a 255-byte limit)
  return sanitized.substring(0, maxLength);
};

/**
 * Generate display name for a match
 * @param {Object} match - Match object
 * @returns {string} - Generated display name or filename fallback
 */
export const generateDisplayName = (match) => {
  // If displayName is provided, sanitize and use it
  if (match.displayName) {
    const sanitized = sanitizeFilenameComponent(match.displayName);
    if (sanitized) {
      // Ensure .dem extension
      return sanitized.endsWith('.dem') ? sanitized : `${sanitized}.dem`;
    }
  }

  // Generate from match data with sanitization
  if (match.teams && match.teams.length >= 2 && match.map && match.stage) {
    const teamA = match.teams[0];
    const teamB = match.teams[1];
    const formattedDate = formatMatchDate(match.playedAt);

    // Sanitize all components
    const teamAName = sanitizeFilenameComponent(teamA.name) || 'Team1';
    const teamBName = sanitizeFilenameComponent(teamB.name) || 'Team2';
    const mapName = sanitizeFilenameComponent(match.map) || 'unknown';
    const stageName = sanitizeFilenameComponent(match.stage) || 'match';
    const datePart = sanitizeFilenameComponent(formattedDate);

    if (datePart) {
      return `${teamAName} vs ${teamBName} - ${mapName} - ${stageName} - ${datePart}.dem`;
    }
    return `${teamAName} vs ${teamBName} - ${mapName} - ${stageName}.dem`;
  }

  // Fallback to sanitized fileName or default
  const sanitizedFileName = sanitizeFilenameComponent(match.fileName);
  return sanitizedFileName || 'demo.dem';
};

function serializeRow(row) {
  const raw = rowToObject(row);
  const match = {
    id: raw.id,
    tournamentId: raw.tournamentId ?? null,
    event: raw.event ?? null,
    stage: raw.stage ?? null,
    fileName: raw.fileName,
    displayName: raw.displayName ?? null,
    fileSizeMB: raw.fileSizeMB ?? null,
    map: raw.map ?? null,
    bestOf: raw.bestOf ?? null,
    playedAt: raw.playedAt ? raw.playedAt.toISOString() : null,
    teams: raw.teams ? JSON.parse(raw.teams) : null,
    highlights: raw.highlights ? JSON.parse(raw.highlights) : undefined,
    durationMinutes: raw.durationMinutes ?? undefined,
    rounds: raw.rounds ?? undefined,
    notes: raw.notes ?? undefined,
    parseStatus: raw.parseStatus ?? 'pending',
    parseError: raw.parseError ?? undefined,
  };

  // Remove undefined fields
  Object.keys(match).forEach(key => {
    if (match[key] === undefined) {
      delete match[key];
    }
  });

  return match;
}

/**
 * Serialize match for public/unauthenticated endpoints (removes internal file paths)
 * @param {Object} row - Database row
 * @returns {Object} - Match object without fileName
 */
function serializeRowPublic(row) {
  const match = serializeRow(row);
  // Remove fileName to prevent exposing internal file paths
  const { fileName, ...publicMatch } = match;
  return publicMatch;
}

function serializeRows(rows) {
  return rows.map(row => serializeRow(row));
}

/**
 * Serialize rows for public/unauthenticated endpoints (removes internal file paths)
 * @param {Array} rows - Database rows
 * @returns {Array} - Array of match objects without fileName
 */
function serializeRowsPublic(rows) {
  return rows.map(row => serializeRowPublic(row));
}

/**
 * Validate demo match structure
 * @param {Object} match - Match object to validate
 * @returns {boolean}
 */
function validateMatch(match) {
  const requiredFields = ['id', 'tournamentId', 'event', 'stage', 'bestOf'];

  for (const field of requiredFields) {
    if (match[field] === undefined || match[field] === null) {
      return false;
    }
  }

  if (match.teams) {
    // Validate teams array
    if (!Array.isArray(match.teams) || match.teams.length !== 2) {
      return false;
    }

  }

  return true;
}

/**
 * Get all demo matches
 * @param {Function} serializer - Optional serialization function (defaults to serializeRows)
 * @returns {Promise<Array>}
 */
export const getDemoMatches = async (serializer = serializeRows) => {
  const { rows } = await execute(
    `SELECT * FROM ${TABLE} ORDER BY [playedAt] DESC`
  );
  return serializer(rows);
};

/**
 * Get all demo matches for public/unauthenticated endpoints (without internal file paths)
 * @returns {Promise<Array>}
 */
export const getDemoMatchesPublic = async () => {
  return getDemoMatches(serializeRowsPublic);
};

/**
 * Get demo match by ID
 * @param {string} id - Match ID
 * @returns {Promise<Object|null>}
 */
export const getDemoMatchById = async (id) => {
  if (!id || typeof id !== 'string') {
    return null;
  }

  const { rows } = await execute(
    `SELECT * FROM ${TABLE} WHERE [id] = @id`,
    [{ name: 'id', type: TYPES.NVarChar, value: id }]
  );

  if (rows.length === 0) {
    return null;
  }

  return serializeRow(rows[0]);
};

/**
 * Get demo match by ID for public/unauthenticated endpoints (without internal file paths)
 * @param {string} id - Match ID
 * @returns {Promise<Object|null>}
 */
export const getDemoMatchByIdPublic = async (id) => {
  const match = await getDemoMatchById(id);
  if (!match) return null;
  const { fileName, ...publicMatch } = match;
  return publicMatch;
};

/**
 * Get all matches for a specific tournament
 * @param {string} tournamentId - Tournament ID
 * @param {Function} serializer - Optional serialization function (defaults to serializeRows)
 * @returns {Promise<Array>}
 */
export const getDemoMatchesByTournament = async (tournamentId, serializer = serializeRows) => {
  if (!tournamentId || typeof tournamentId !== 'string') {
    return [];
  }

  const { rows } = await execute(
    `SELECT * FROM ${TABLE} WHERE [tournamentId] = @tournamentId ORDER BY [playedAt] DESC`,
    [{ name: 'tournamentId', type: TYPES.NVarChar, value: tournamentId }]
  );
  return serializer(rows);
};

/**
 * Get all matches for a specific tournament for public/unauthenticated endpoints (without internal file paths)
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<Array>}
 */
export const getDemoMatchesByTournamentPublic = async (tournamentId) => {
  return getDemoMatchesByTournament(tournamentId, serializeRowsPublic);
};

/**
 * Create a new demo match
 * @param {Object} matchData - Match data
 * @returns {Promise<Object>}
 */
export const createDemoMatch = async (matchData) => {
  if (!validateMatch(matchData)) {
    throw createHttpError(400, 'Invalid match data: missing required fields');
  }

  // Check if match with this ID already exists
  const existing = await getDemoMatchById(matchData.id);
  if (existing) {
    throw createHttpError(409, `Match with ID '${matchData.id}' already exists`);
  }

  // Prepare teams and highlights as JSON strings
  const teamsJson = JSON.stringify(matchData.teams);
  const highlightsJson = matchData.highlights ? JSON.stringify(matchData.highlights) : null;
  const playedAtDate = new Date(matchData.playedAt);

  const params = [
    { name: 'id', type: TYPES.NVarChar, value: matchData.id },
    { name: 'tournamentId', type: TYPES.NVarChar, value: matchData.tournamentId },
    { name: 'event', type: TYPES.NVarChar, value: matchData.event },
    { name: 'stage', type: TYPES.NVarChar, value: matchData.stage },
    { name: 'map', type: TYPES.NVarChar, value: matchData.map },
    { name: 'bestOf', type: TYPES.Int, value: matchData.bestOf },
    { name: 'playedAt', type: TYPES.DateTime, value: playedAtDate },
    { name: 'teams', type: TYPES.NVarChar, value: teamsJson },
  ];

  const columns = [
    '[id]', '[tournamentId]', '[event]', '[stage]',
    '[map]', '[bestOf]', '[playedAt]', '[teams]'
  ];
  const values = [
    '@id', '@tournamentId', '@event', '@stage',
    '@map', '@bestOf', '@playedAt', '@teams'
  ];

  // Optional fields
  if (matchData.fileName !== undefined && matchData.fileName !== null) {
    columns.push('[fileName]');
    values.push('@fileName');
    params.push({ name: 'fileName', type: TYPES.NVarChar, value: matchData.fileName });
  }

  if (matchData.fileSizeMB !== undefined && matchData.fileSizeMB !== null) {
    columns.push('[fileSizeMB]');
    values.push('@fileSizeMB');
    params.push({ name: 'fileSizeMB', type: TYPES.Float, value: matchData.fileSizeMB });
  }

  if (matchData.displayName) {
    columns.push('[displayName]');
    values.push('@displayName');
    params.push({ name: 'displayName', type: TYPES.NVarChar, value: matchData.displayName });
  }

  if (highlightsJson) {
    columns.push('[highlights]');
    values.push('@highlights');
    params.push({ name: 'highlights', type: TYPES.NVarChar, value: highlightsJson });
  }

  if (matchData.durationMinutes !== undefined && matchData.durationMinutes !== null) {
    columns.push('[durationMinutes]');
    values.push('@durationMinutes');
    params.push({ name: 'durationMinutes', type: TYPES.Int, value: matchData.durationMinutes });
  }

  if (matchData.rounds !== undefined && matchData.rounds !== null) {
    columns.push('[rounds]');
    values.push('@rounds');
    params.push({ name: 'rounds', type: TYPES.Int, value: matchData.rounds });
  }

  if (matchData.notes) {
    columns.push('[notes]');
    values.push('@notes');
    params.push({ name: 'notes', type: TYPES.NVarChar, value: matchData.notes });
  }

  if (matchData.parseStatus !== undefined) {
    columns.push('[parseStatus]');
    values.push('@parseStatus');
    params.push({ name: 'parseStatus', type: TYPES.NVarChar, value: matchData.parseStatus });
  }

  if (matchData.parseError !== undefined) {
    columns.push('[parseError]');
    values.push('@parseError');
    params.push({ name: 'parseError', type: TYPES.NVarChar, value: matchData.parseError });
  }

  const query = `INSERT INTO ${TABLE} (${columns.join(', ')}) OUTPUT INSERTED.* VALUES (${values.join(', ')});`;

  const { rows } = await execute(query, params);
  return serializeRow(rows[0]);
};

/**
 * Update an existing demo match
 * @param {string} id - Match ID
 * @param {Object} matchData - Updated match data
 * @returns {Promise<Object|null>}
 */
export const updateDemoMatch = async (id, matchData) => {
  if (!id || typeof id !== 'string') {
    return null;
  }

  // Check if match exists
  const existing = await getDemoMatchById(id);
  if (!existing) {
    return null;
  }

  // Merge existing match with updates
  const updatedMatch = {
    ...existing,
    ...matchData,
    id, // Ensure ID can't be changed
  };

  if (!validateMatch(updatedMatch)) {
    throw createHttpError(400, 'Invalid match data: missing required fields');
  }

  // Prepare teams and highlights as JSON strings
  const teamsJson = JSON.stringify(updatedMatch.teams);
  const highlightsJson = updatedMatch.highlights ? JSON.stringify(updatedMatch.highlights) : null;
  const playedAtDate = new Date(updatedMatch.playedAt);

  const assignments = [];
  const params = [];

  assignments.push('[tournamentId] = @tournamentId');
  params.push({ name: 'tournamentId', type: TYPES.NVarChar, value: updatedMatch.tournamentId });

  assignments.push('[event] = @event');
  params.push({ name: 'event', type: TYPES.NVarChar, value: updatedMatch.event });

  assignments.push('[stage] = @stage');
  params.push({ name: 'stage', type: TYPES.NVarChar, value: updatedMatch.stage });

  assignments.push('[fileName] = @fileName');
  params.push({ name: 'fileName', type: TYPES.NVarChar, value: updatedMatch.fileName });

  if (updatedMatch.displayName !== undefined) {
    assignments.push('[displayName] = @displayName');
    params.push({ name: 'displayName', type: TYPES.NVarChar, value: updatedMatch.displayName || null });
  }

  assignments.push('[fileSizeMB] = @fileSizeMB');
  params.push({ name: 'fileSizeMB', type: TYPES.Float, value: updatedMatch.fileSizeMB });

  assignments.push('[map] = @map');
  params.push({ name: 'map', type: TYPES.NVarChar, value: updatedMatch.map });

  assignments.push('[bestOf] = @bestOf');
  params.push({ name: 'bestOf', type: TYPES.Int, value: updatedMatch.bestOf });

  assignments.push('[playedAt] = @playedAt');
  params.push({ name: 'playedAt', type: TYPES.DateTime, value: playedAtDate });

  assignments.push('[teams] = @teams');
  params.push({ name: 'teams', type: TYPES.NVarChar, value: teamsJson });

  if (updatedMatch.highlights !== undefined) {
    assignments.push('[highlights] = @highlights');
    params.push({ name: 'highlights', type: TYPES.NVarChar, value: highlightsJson });
  }

  if (updatedMatch.durationMinutes !== undefined) {
    assignments.push('[durationMinutes] = @durationMinutes');
    params.push({ name: 'durationMinutes', type: TYPES.Int, value: updatedMatch.durationMinutes });
  }

  if (updatedMatch.rounds !== undefined) {
    assignments.push('[rounds] = @rounds');
    params.push({ name: 'rounds', type: TYPES.Int, value: updatedMatch.rounds });
  }

  if (updatedMatch.notes !== undefined) {
    assignments.push('[notes] = @notes');
    params.push({ name: 'notes', type: TYPES.NVarChar, value: updatedMatch.notes || null });
  }

  if (updatedMatch.parseStatus !== undefined) {
    assignments.push('[parseStatus] = @parseStatus');
    params.push({ name: 'parseStatus', type: TYPES.NVarChar, value: updatedMatch.parseStatus });
  }

  if (updatedMatch.parseError !== undefined) {
    assignments.push('[parseError] = @parseError');
    params.push({ name: 'parseError', type: TYPES.NVarChar, value: updatedMatch.parseError || null });
  }

  assignments.push('[updatedAt] = GETDATE()');

  params.push({ name: 'id', type: TYPES.NVarChar, value: id });

  const query = `UPDATE ${TABLE}
    SET ${assignments.join(', ')}
    OUTPUT INSERTED.*
    WHERE [id] = @id;`;

  const { rows, rowCount } = await execute(query, params);

  if (rowCount === 0) {
    return null;
  }

  return serializeRow(rows[0]);
};

/**
 * Delete a demo match
 * @param {string} id - Match ID
 * @returns {Promise<boolean>}
 */
export const deleteDemoMatch = async (id) => {
  if (!id || typeof id !== 'string') {
    return false;
  }

  const query = `DELETE FROM ${TABLE} OUTPUT DELETED.[id] WHERE [id] = @id;`;
  const { rowCount } = await execute(query, [
    { name: 'id', type: TYPES.NVarChar, value: id },
  ]);
  return rowCount > 0;
};

/**
 * Get demo data structure with schema version
 * @param {Function} serializer - Optional serialization function (defaults to serializeRows)
 * @returns {Promise<Object>}
 */
export const getDemoData = async (serializer = serializeRows) => {
  const matches = await getDemoMatches(serializer);
  return {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    matches,
  };
};

/**
 * Get demo data structure with schema version for public/unauthenticated endpoints (without internal file paths)
 * @returns {Promise<Object>}
 */
export const getDemoDataPublic = async () => {
  return getDemoData(serializeRowsPublic);
};

/**
 * Upsert demo match (create or update)
 * @param {Object} matchData - Match data
 * @returns {Promise<Object>}
 * 
 * @note Performance Consideration: This function performs a SELECT to check existence
 * before INSERT/UPDATE. A SQL MERGE statement would be more efficient (single query),
 * but implementing MERGE with 10+ optional fields in Tedious would significantly increase
 * code complexity and maintainability burden. Since this function processes single matches
 * (not bulk operations), the current approach is acceptable. Consider SQL MERGE if this
 * becomes a performance bottleneck in profiling.
 */
export const upsertDemoMatch = async (matchData) => {
  if (!validateMatch(matchData)) {
    throw createHttpError(400, 'Invalid match data: missing required fields');
  }

  // Check if match exists
  const existing = await getDemoMatchById(matchData.id);

  if (existing) {
    // Update existing match
    return await updateDemoMatch(matchData.id, matchData);
  } else {
    // Create new match
    return await createDemoMatch(matchData);
  }
};

/**
 * Upsert match players (create or update)
 * @param {string} matchId - Match ID
 * @param {Object|Array} playersData - Single player or array of players
 * @returns {Promise<Object>}
 */
export const upsertMatchPlayers = async (matchId, playersData) => {
  if (!matchId || typeof matchId !== 'string') {
    throw createHttpError(400, 'Invalid match ID');
  }

  // Verify match exists
  const match = await getDemoMatchById(matchId);
  if (!match) {
    throw createHttpError(404, 'Match not found');
  }

  // Normalize to array
  const players = Array.isArray(playersData) ? playersData : [playersData];

  if (players.length === 0) {
    throw createHttpError(400, 'No players provided');
  }

  // Batch fetch all existing players for this match to avoid N+1 queries
  const steamIds = players.map(p => p.steamId).filter(Boolean);
  const steamIdPlaceholders = steamIds.map((_, i) => `@steamId${i}`).join(', ');
  const steamIdParams = steamIds.map((id, i) => ({
    name: `steamId${i}`,
    type: TYPES.NVarChar,
    value: id
  }));

  const { rows: existingRows } = await execute(
    `SELECT [id], [steamId] FROM [DemoMatchPlayers] WHERE [matchId] = @matchId ${steamIds.length > 0 ? `AND [steamId] IN (${steamIdPlaceholders})` : 'AND 1=0'}`,
    [{ name: 'matchId', type: TYPES.NVarChar, value: matchId }, ...steamIdParams]
  );

  // Build a map of existing players
  const existingPlayersMap = new Map();
  existingRows.forEach(row => {
    const obj = rowToObject(row);
    existingPlayersMap.set(obj.steamId, obj.id);
  });

  let processed = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors = [];

  for (const player of players) {
    try {
      // Validate required fields
      if (!player.steamId || !player.playerName || !player.team) {
        throw new Error('Missing required fields: steamId, playerName, team');
      }

      if (!['CT', 'T'].includes(player.team)) {
        throw new Error('team must be either CT or T');
      }

      // Check if player exists using the pre-fetched map
      const exists = existingPlayersMap.has(player.steamId);

      if (exists) {
        // Update existing player
        const assignments = [];
        const params = [
          { name: 'matchId', type: TYPES.NVarChar, value: matchId },
          { name: 'steamId', type: TYPES.NVarChar, value: player.steamId }
        ];

        assignments.push('[playerName] = @playerName');
        params.push({ name: 'playerName', type: TYPES.NVarChar, value: player.playerName });

        assignments.push('[team] = @team');
        params.push({ name: 'team', type: TYPES.NVarChar, value: player.team });

        if (player.kills !== undefined) {
          assignments.push('[kills] = @kills');
          params.push({ name: 'kills', type: TYPES.Int, value: player.kills ?? 0 });
        }
        if (player.deaths !== undefined) {
          assignments.push('[deaths] = @deaths');
          params.push({ name: 'deaths', type: TYPES.Int, value: player.deaths ?? 0 });
        }
        if (player.assists !== undefined) {
          assignments.push('[assists] = @assists');
          params.push({ name: 'assists', type: TYPES.Int, value: player.assists ?? 0 });
        }
        if (player.adr !== undefined) {
          assignments.push('[adr] = @adr');
          params.push({ name: 'adr', type: TYPES.Float, value: player.adr ?? 0 });
        }
        if (player.headshotPercentage !== undefined) {
          assignments.push('[headshotPercentage] = @headshotPercentage');
          params.push({ name: 'headshotPercentage', type: TYPES.Float, value: player.headshotPercentage ?? 0 });
        }
        if (player.firstKills !== undefined) {
          assignments.push('[firstKills] = @firstKills');
          params.push({ name: 'firstKills', type: TYPES.Int, value: player.firstKills ?? 0 });
        }
        if (player.firstDeaths !== undefined) {
          assignments.push('[firstDeaths] = @firstDeaths');
          params.push({ name: 'firstDeaths', type: TYPES.Int, value: player.firstDeaths ?? 0 });
        }
        if (player.tradeKills !== undefined) {
          assignments.push('[tradeKills] = @tradeKills');
          params.push({ name: 'tradeKills', type: TYPES.Int, value: player.tradeKills ?? 0 });
        }
        if (player.clutchesWon !== undefined) {
          assignments.push('[clutchesWon] = @clutchesWon');
          params.push({ name: 'clutchesWon', type: TYPES.Int, value: player.clutchesWon ?? 0 });
        }
        if (player.clutchesLost !== undefined) {
          assignments.push('[clutchesLost] = @clutchesLost');
          params.push({ name: 'clutchesLost', type: TYPES.Int, value: player.clutchesLost ?? 0 });
        }
        if (player.utilityDamage !== undefined) {
          assignments.push('[utilityDamage] = @utilityDamage');
          params.push({ name: 'utilityDamage', type: TYPES.Float, value: player.utilityDamage ?? 0 });
        }
        if (player.flashAssists !== undefined) {
          assignments.push('[flashAssists] = @flashAssists');
          params.push({ name: 'flashAssists', type: TYPES.Int, value: player.flashAssists ?? 0 });
        }

        assignments.push('[updatedAt] = GETDATE()');

        await execute(
          `UPDATE [DemoMatchPlayers] SET ${assignments.join(', ')} WHERE [matchId] = @matchId AND [steamId] = @steamId`,
          params
        );
        updated++;
      } else {
        // Create new player
        const columns = ['[id]', '[matchId]', '[steamId]', '[playerName]', '[team]'];
        const values = ['NEWID()', '@matchId', '@steamId', '@playerName', '@team'];
        const params = [
          { name: 'matchId', type: TYPES.NVarChar, value: matchId },
          { name: 'steamId', type: TYPES.NVarChar, value: player.steamId },
          { name: 'playerName', type: TYPES.NVarChar, value: player.playerName },
          { name: 'team', type: TYPES.NVarChar, value: player.team }
        ];

        if (player.kills !== undefined) {
          columns.push('[kills]');
          values.push('@kills');
          params.push({ name: 'kills', type: TYPES.Int, value: player.kills ?? 0 });
        }
        if (player.deaths !== undefined) {
          columns.push('[deaths]');
          values.push('@deaths');
          params.push({ name: 'deaths', type: TYPES.Int, value: player.deaths ?? 0 });
        }
        if (player.assists !== undefined) {
          columns.push('[assists]');
          values.push('@assists');
          params.push({ name: 'assists', type: TYPES.Int, value: player.assists ?? 0 });
        }
        if (player.adr !== undefined) {
          columns.push('[adr]');
          values.push('@adr');
          params.push({ name: 'adr', type: TYPES.Float, value: player.adr ?? 0 });
        }
        if (player.headshotPercentage !== undefined) {
          columns.push('[headshotPercentage]');
          values.push('@headshotPercentage');
          params.push({ name: 'headshotPercentage', type: TYPES.Float, value: player.headshotPercentage ?? 0 });
        }
        if (player.firstKills !== undefined) {
          columns.push('[firstKills]');
          values.push('@firstKills');
          params.push({ name: 'firstKills', type: TYPES.Int, value: player.firstKills ?? 0 });
        }
        if (player.firstDeaths !== undefined) {
          columns.push('[firstDeaths]');
          values.push('@firstDeaths');
          params.push({ name: 'firstDeaths', type: TYPES.Int, value: player.firstDeaths ?? 0 });
        }
        if (player.tradeKills !== undefined) {
          columns.push('[tradeKills]');
          values.push('@tradeKills');
          params.push({ name: 'tradeKills', type: TYPES.Int, value: player.tradeKills ?? 0 });
        }
        if (player.clutchesWon !== undefined) {
          columns.push('[clutchesWon]');
          values.push('@clutchesWon');
          params.push({ name: 'clutchesWon', type: TYPES.Int, value: player.clutchesWon ?? 0 });
        }
        if (player.clutchesLost !== undefined) {
          columns.push('[clutchesLost]');
          values.push('@clutchesLost');
          params.push({ name: 'clutchesLost', type: TYPES.Int, value: player.clutchesLost ?? 0 });
        }
        if (player.utilityDamage !== undefined) {
          columns.push('[utilityDamage]');
          values.push('@utilityDamage');
          params.push({ name: 'utilityDamage', type: TYPES.Float, value: player.utilityDamage ?? 0 });
        }
        if (player.flashAssists !== undefined) {
          columns.push('[flashAssists]');
          values.push('@flashAssists');
          params.push({ name: 'flashAssists', type: TYPES.Int, value: player.flashAssists ?? 0 });
        }

        await execute(
          `INSERT INTO [DemoMatchPlayers] (${columns.join(', ')}) VALUES (${values.join(', ')})`,
          params
        );
        created++;
      }
      processed++;
    } catch (error) {
      failed++;
      errors.push({
        steamId: player.steamId,
        message: error.message,
        stack: error.stack
      });
    }
  }

  // Fetch all players for this match to return in response
  const { rows: allPlayersRows } = await execute(
    `SELECT * FROM [DemoMatchPlayers] WHERE [matchId] = @matchId`,
    [{ name: 'matchId', type: TYPES.NVarChar, value: matchId }]
  );

  const allPlayers = allPlayersRows.map(row => {
    const player = rowToObject(row);
    return {
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
      createdAt: player.createdAt ? player.createdAt.toISOString() : null,
      updatedAt: player.updatedAt ? player.updatedAt.toISOString() : null,
    };
  });

  return {
    processed,
    created,
    updated,
    failed,
    errors: failed > 0 ? errors : undefined,
    players: allPlayers
  };
};

/**
 * Create match rounds (upsert by matchId + roundNumber)
 * @param {string} matchId - Match ID
 * @param {Object|Array} roundsData - Single round or array of rounds
 * @returns {Promise<Object>}
 */
export const createMatchRounds = async (matchId, roundsData) => {
  if (!matchId || typeof matchId !== 'string') {
    throw createHttpError(400, 'Invalid match ID');
  }

  // Verify match exists
  const match = await getDemoMatchById(matchId);
  if (!match) {
    throw createHttpError(404, 'Match not found');
  }

  // Normalize to array
  const rounds = Array.isArray(roundsData) ? roundsData : [roundsData];

  if (rounds.length === 0) {
    throw createHttpError(400, 'No rounds provided');
  }

  // Batch fetch all existing rounds for this match to avoid N+1 queries
  const roundNumbers = rounds.map(r => r.roundNumber).filter(n => n !== undefined);
  const roundNumPlaceholders = roundNumbers.map((_, i) => `@roundNum${i}`).join(', ');
  const roundNumParams = roundNumbers.map((num, i) => ({
    name: `roundNum${i}`,
    type: TYPES.Int,
    value: num
  }));

  const { rows: existingRows } = await execute(
    `SELECT [id], [roundNumber] FROM [DemoMatchRounds] WHERE [matchId] = @matchId ${roundNumbers.length > 0 ? `AND [roundNumber] IN (${roundNumPlaceholders})` : 'AND 1=0'}`,
    [{ name: 'matchId', type: TYPES.NVarChar, value: matchId }, ...roundNumParams]
  );

  // Build a map of existing rounds
  const existingRoundsMap = new Map();
  existingRows.forEach(row => {
    const obj = rowToObject(row);
    existingRoundsMap.set(obj.roundNumber, obj.id);
  });

  let processed = 0;
  let created = 0;
  let failed = 0;
  const errors = [];
  const roundIds = [];

  for (const round of rounds) {
    try {
      // Validate required fields
      if (round.roundNumber === undefined || round.winner === undefined ||
        round.winReason === undefined || round.ctScore === undefined ||
        round.tScore === undefined) {
        throw new Error('Missing required fields: roundNumber, winner, winReason, ctScore, tScore');
      }

      if (!['CT', 'T'].includes(round.winner)) {
        throw new Error('winner must be either CT or T');
      }

      if (!['elimination', 'defuse', 'time', 'bomb'].includes(round.winReason)) {
        throw new Error('winReason must be one of: elimination, defuse, time, bomb');
      }

      // Check if round exists using the pre-fetched map
      const exists = existingRoundsMap.has(round.roundNumber);
      let roundId;

      if (exists) {
        // Update existing round
        roundId = existingRoundsMap.get(round.roundNumber);
        const assignments = [];
        const params = [
          { name: 'matchId', type: TYPES.NVarChar, value: matchId },
          { name: 'roundNumber', type: TYPES.Int, value: round.roundNumber }
        ];

        assignments.push('[winner] = @winner');
        params.push({ name: 'winner', type: TYPES.NVarChar, value: round.winner });

        assignments.push('[winReason] = @winReason');
        params.push({ name: 'winReason', type: TYPES.NVarChar, value: round.winReason });

        assignments.push('[ctScore] = @ctScore');
        params.push({ name: 'ctScore', type: TYPES.Int, value: round.ctScore });

        assignments.push('[tScore] = @tScore');
        params.push({ name: 'tScore', type: TYPES.Int, value: round.tScore });

        if (round.durationSeconds !== undefined) {
          assignments.push('[durationSeconds] = @durationSeconds');
          params.push({ name: 'durationSeconds', type: TYPES.Int, value: round.durationSeconds });
        }
        if (round.startTick !== undefined) {
          assignments.push('[startTick] = @startTick');
          params.push({ name: 'startTick', type: TYPES.Int, value: round.startTick });
        }
        if (round.endTick !== undefined) {
          assignments.push('[endTick] = @endTick');
          params.push({ name: 'endTick', type: TYPES.Int, value: round.endTick });
        }

        await execute(
          `UPDATE [DemoMatchRounds] SET ${assignments.join(', ')} WHERE [matchId] = @matchId AND [roundNumber] = @roundNumber`,
          params
        );
      } else {
        // Create new round
        const columns = ['[id]', '[matchId]', '[roundNumber]', '[winner]', '[winReason]', '[ctScore]', '[tScore]'];
        const values = ['NEWID()', '@matchId', '@roundNumber', '@winner', '@winReason', '@ctScore', '@tScore'];
        const params = [
          { name: 'matchId', type: TYPES.NVarChar, value: matchId },
          { name: 'roundNumber', type: TYPES.Int, value: round.roundNumber },
          { name: 'winner', type: TYPES.NVarChar, value: round.winner },
          { name: 'winReason', type: TYPES.NVarChar, value: round.winReason },
          { name: 'ctScore', type: TYPES.Int, value: round.ctScore },
          { name: 'tScore', type: TYPES.Int, value: round.tScore }
        ];

        if (round.durationSeconds !== undefined) {
          columns.push('[durationSeconds]');
          values.push('@durationSeconds');
          params.push({ name: 'durationSeconds', type: TYPES.Int, value: round.durationSeconds });
        }
        if (round.startTick !== undefined) {
          columns.push('[startTick]');
          values.push('@startTick');
          params.push({ name: 'startTick', type: TYPES.Int, value: round.startTick });
        }
        if (round.endTick !== undefined) {
          columns.push('[endTick]');
          values.push('@endTick');
          params.push({ name: 'endTick', type: TYPES.Int, value: round.endTick });
        }

        const { rows } = await execute(
          `INSERT INTO [DemoMatchRounds] (${columns.join(', ')}) OUTPUT INSERTED.[id] VALUES (${values.join(', ')})`,
          params
        );
        roundId = rowToObject(rows[0]).id;
        created++;
      }

      roundIds.push(roundId);
      processed++;
    } catch (error) {
      failed++;
      errors.push({
        roundNumber: round.roundNumber,
        message: error.message,
        stack: error.stack
      });
    }
  }

  return { processed, created, roundIds, failed, errors: failed > 0 ? errors : undefined };
};

/**
 * Create round events (append-only)
 * @param {string} matchId - Match ID
 * @param {string} roundId - Round ID
 * @param {Object|Array} eventsData - Single event or array of events
 * @returns {Promise<Object>}
 */
export const createRoundEvents = async (matchId, roundId, eventsData) => {
  if (!matchId || typeof matchId !== 'string') {
    throw createHttpError(400, 'Invalid match ID');
  }

  if (!roundId || typeof roundId !== 'string') {
    throw createHttpError(400, 'Invalid round ID');
  }

  // Verify match exists
  const match = await getDemoMatchById(matchId);
  if (!match) {
    throw createHttpError(404, 'Match not found');
  }

  // Verify round exists and belongs to match
  const { rows: roundRows } = await execute(
    `SELECT [id], [roundNumber] FROM [DemoMatchRounds] WHERE [id] = @roundId AND [matchId] = @matchId`,
    [
      { name: 'roundId', type: TYPES.NVarChar, value: roundId },
      { name: 'matchId', type: TYPES.NVarChar, value: matchId }
    ]
  );

  if (roundRows.length === 0) {
    throw createHttpError(404, 'Round not found');
  }

  const round = rowToObject(roundRows[0]);
  const roundNumber = round.roundNumber;

  // Normalize to array
  const events = Array.isArray(eventsData) ? eventsData : [eventsData];

  if (events.length === 0) {
    throw createHttpError(400, 'No events provided');
  }

  let processed = 0;
  let created = 0;
  let failed = 0;
  const errors = [];
  const eventIds = [];

  for (const event of events) {
    try {
      // Validate required fields
      if (event.roundNumber === undefined || event.eventType === undefined || event.tick === undefined) {
        throw new Error('Missing required fields: roundNumber, eventType, tick');
      }

      const validEventTypes = ['kill', 'assist', 'death', 'flash', 'smoke', 'he', 'molotov', 'defuse', 'plant'];
      if (!validEventTypes.includes(event.eventType)) {
        throw new Error(`eventType must be one of: ${validEventTypes.join(', ')}`);
      }

      // Create event
      const columns = ['[id]', '[roundId]', '[matchId]', '[roundNumber]', '[eventType]', '[tick]'];
      const values = ['NEWID()', '@roundId', '@matchId', '@roundNumber', '@eventType', '@tick'];
      const params = [
        { name: 'roundId', type: TYPES.NVarChar, value: roundId },
        { name: 'matchId', type: TYPES.NVarChar, value: matchId },
        { name: 'roundNumber', type: TYPES.Int, value: event.roundNumber },
        { name: 'eventType', type: TYPES.NVarChar, value: event.eventType },
        { name: 'tick', type: TYPES.Int, value: event.tick }
      ];

      if (event.attackerSteamId !== undefined) {
        columns.push('[attackerSteamId]');
        values.push('@attackerSteamId');
        params.push({ name: 'attackerSteamId', type: TYPES.NVarChar, value: event.attackerSteamId });
      }
      if (event.victimSteamId !== undefined) {
        columns.push('[victimSteamId]');
        values.push('@victimSteamId');
        params.push({ name: 'victimSteamId', type: TYPES.NVarChar, value: event.victimSteamId });
      }
      if (event.assisterSteamId !== undefined) {
        columns.push('[assisterSteamId]');
        values.push('@assisterSteamId');
        params.push({ name: 'assisterSteamId', type: TYPES.NVarChar, value: event.assisterSteamId });
      }
      if (event.weapon !== undefined) {
        columns.push('[weapon]');
        values.push('@weapon');
        params.push({ name: 'weapon', type: TYPES.NVarChar, value: event.weapon });
      }
      if (event.isHeadshot !== undefined) {
        columns.push('[isHeadshot]');
        values.push('@isHeadshot');
        params.push({ name: 'isHeadshot', type: TYPES.Bit, value: event.isHeadshot ? 1 : 0 });
      }
      if (event.isTradeKill !== undefined) {
        columns.push('[isTradeKill]');
        values.push('@isTradeKill');
        params.push({ name: 'isTradeKill', type: TYPES.Bit, value: event.isTradeKill ? 1 : 0 });
      }
      if (event.positionX !== undefined) {
        columns.push('[positionX]');
        values.push('@positionX');
        params.push({ name: 'positionX', type: TYPES.Float, value: event.positionX });
      }
      if (event.positionY !== undefined) {
        columns.push('[positionY]');
        values.push('@positionY');
        params.push({ name: 'positionY', type: TYPES.Float, value: event.positionY });
      }
      if (event.positionZ !== undefined) {
        columns.push('[positionZ]');
        values.push('@positionZ');
        params.push({ name: 'positionZ', type: TYPES.Float, value: event.positionZ });
      }
      if (event.eventData !== undefined) {
        columns.push('[eventData]');
        values.push('@eventData');
        params.push({ name: 'eventData', type: TYPES.NVarChar, value: JSON.stringify(event.eventData) });
      }

      const { rows } = await execute(
        `INSERT INTO [DemoRoundEvents] (${columns.join(', ')}) OUTPUT INSERTED.[id] VALUES (${values.join(', ')})`,
        params
      );

      eventIds.push(rowToObject(rows[0]).id);
      created++;
      processed++;
    } catch (error) {
      failed++;
      errors.push(`Event at tick ${event.tick}: ${error.message}`);
    }
  }

  return { processed, created, eventIds, failed, errors: failed > 0 ? errors : undefined };
};

/**
 * Upsert match insights
 * @param {string} matchId - Match ID
 * @param {Object} insightsData - Insights data
 * @returns {Promise<Object>}
 */
export const upsertMatchInsights = async (matchId, insightsData) => {
  if (!matchId || typeof matchId !== 'string') {
    throw createHttpError(400, 'Invalid match ID');
  }

  // Verify match exists
  const match = await getDemoMatchById(matchId);
  if (!match) {
    throw createHttpError(404, 'Match not found');
  }

  // Check if insights exist
  const { rows: existingRows } = await execute(
    `SELECT [id] FROM [DemoMatchInsights] WHERE [matchId] = @matchId`,
    [{ name: 'matchId', type: TYPES.NVarChar, value: matchId }]
  );

  const exists = existingRows.length > 0;

  if (exists) {
    // Update existing insights
    const insightId = rowToObject(existingRows[0]).id;
    const assignments = [];
    const params = [{ name: 'matchId', type: TYPES.NVarChar, value: matchId }];

    if (insightsData.ctSideStats !== undefined) {
      assignments.push('[ctSideStats] = @ctSideStats');
      params.push({ name: 'ctSideStats', type: TYPES.NVarChar, value: JSON.stringify(insightsData.ctSideStats) });
    }
    if (insightsData.tSideStats !== undefined) {
      assignments.push('[tSideStats] = @tSideStats');
      params.push({ name: 'tSideStats', type: TYPES.NVarChar, value: JSON.stringify(insightsData.tSideStats) });
    }
    if (insightsData.economyAnalysis !== undefined) {
      assignments.push('[economyAnalysis] = @economyAnalysis');
      params.push({ name: 'economyAnalysis', type: TYPES.NVarChar, value: JSON.stringify(insightsData.economyAnalysis) });
    }
    if (insightsData.utilityUsage !== undefined) {
      assignments.push('[utilityUsage] = @utilityUsage');
      params.push({ name: 'utilityUsage', type: TYPES.NVarChar, value: JSON.stringify(insightsData.utilityUsage) });
    }
    if (insightsData.positioningData !== undefined) {
      assignments.push('[positioningData] = @positioningData');
      params.push({ name: 'positioningData', type: TYPES.NVarChar, value: JSON.stringify(insightsData.positioningData) });
    }
    if (insightsData.clutchAnalysis !== undefined) {
      assignments.push('[clutchAnalysis] = @clutchAnalysis');
      params.push({ name: 'clutchAnalysis', type: TYPES.NVarChar, value: JSON.stringify(insightsData.clutchAnalysis) });
    }
    if (insightsData.tradeAnalysis !== undefined) {
      assignments.push('[tradeAnalysis] = @tradeAnalysis');
      params.push({ name: 'tradeAnalysis', type: TYPES.NVarChar, value: JSON.stringify(insightsData.tradeAnalysis) });
    }
    if (insightsData.roundWinProbability !== undefined) {
      assignments.push('[roundWinProbability] = @roundWinProbability');
      params.push({ name: 'roundWinProbability', type: TYPES.NVarChar, value: JSON.stringify(insightsData.roundWinProbability) });
    }

    assignments.push('[updatedAt] = GETDATE()');

    await execute(
      `UPDATE [DemoMatchInsights] SET ${assignments.join(', ')} WHERE [matchId] = @matchId`,
      params
    );

    // Fetch updated record
    const { rows } = await execute(
      `SELECT * FROM [DemoMatchInsights] WHERE [id] = @id`,
      [{ name: 'id', type: TYPES.NVarChar, value: insightId }]
    );

    return serializeInsight(rows[0]);
  } else {
    // Create new insights
    const columns = ['[id]', '[matchId]'];
    const values = ['NEWID()', '@matchId'];
    const params = [{ name: 'matchId', type: TYPES.NVarChar, value: matchId }];

    if (insightsData.ctSideStats !== undefined) {
      columns.push('[ctSideStats]');
      values.push('@ctSideStats');
      params.push({ name: 'ctSideStats', type: TYPES.NVarChar, value: JSON.stringify(insightsData.ctSideStats) });
    }
    if (insightsData.tSideStats !== undefined) {
      columns.push('[tSideStats]');
      values.push('@tSideStats');
      params.push({ name: 'tSideStats', type: TYPES.NVarChar, value: JSON.stringify(insightsData.tSideStats) });
    }
    if (insightsData.economyAnalysis !== undefined) {
      columns.push('[economyAnalysis]');
      values.push('@economyAnalysis');
      params.push({ name: 'economyAnalysis', type: TYPES.NVarChar, value: JSON.stringify(insightsData.economyAnalysis) });
    }
    if (insightsData.utilityUsage !== undefined) {
      columns.push('[utilityUsage]');
      values.push('@utilityUsage');
      params.push({ name: 'utilityUsage', type: TYPES.NVarChar, value: JSON.stringify(insightsData.utilityUsage) });
    }
    if (insightsData.positioningData !== undefined) {
      columns.push('[positioningData]');
      values.push('@positioningData');
      params.push({ name: 'positioningData', type: TYPES.NVarChar, value: JSON.stringify(insightsData.positioningData) });
    }
    if (insightsData.clutchAnalysis !== undefined) {
      columns.push('[clutchAnalysis]');
      values.push('@clutchAnalysis');
      params.push({ name: 'clutchAnalysis', type: TYPES.NVarChar, value: JSON.stringify(insightsData.clutchAnalysis) });
    }
    if (insightsData.tradeAnalysis !== undefined) {
      columns.push('[tradeAnalysis]');
      values.push('@tradeAnalysis');
      params.push({ name: 'tradeAnalysis', type: TYPES.NVarChar, value: JSON.stringify(insightsData.tradeAnalysis) });
    }
    if (insightsData.roundWinProbability !== undefined) {
      columns.push('[roundWinProbability]');
      values.push('@roundWinProbability');
      params.push({ name: 'roundWinProbability', type: TYPES.NVarChar, value: JSON.stringify(insightsData.roundWinProbability) });
    }

    const { rows } = await execute(
      `INSERT INTO [DemoMatchInsights] (${columns.join(', ')}) OUTPUT INSERTED.* VALUES (${values.join(', ')})`,
      params
    );

    return serializeInsight(rows[0]);
  }
};

/**
 * Serialize insight row to object
 * @param {Object} row - Database row
 * @returns {Object}
 */
function serializeInsight(row) {
  const raw = rowToObject(row);
  const insight = {
    id: raw.id,
    matchId: raw.matchId,
    createdAt: raw.createdAt ? raw.createdAt.toISOString() : null,
    updatedAt: raw.updatedAt ? raw.updatedAt.toISOString() : null,
  };

  if (raw.ctSideStats) {
    insight.ctSideStats = JSON.parse(raw.ctSideStats);
  }
  if (raw.tSideStats) {
    insight.tSideStats = JSON.parse(raw.tSideStats);
  }
  if (raw.economyAnalysis) {
    insight.economyAnalysis = JSON.parse(raw.economyAnalysis);
  }
  if (raw.utilityUsage) {
    insight.utilityUsage = JSON.parse(raw.utilityUsage);
  }
  if (raw.positioningData) {
    insight.positioningData = JSON.parse(raw.positioningData);
  }
  if (raw.clutchAnalysis) {
    insight.clutchAnalysis = JSON.parse(raw.clutchAnalysis);
  }
  if (raw.tradeAnalysis) {
    insight.tradeAnalysis = JSON.parse(raw.tradeAnalysis);
  }
  if (raw.roundWinProbability) {
    insight.roundWinProbability = JSON.parse(raw.roundWinProbability);
  }

  return insight;
}

/**
 * Update match parse status
 * @param {string} matchId - Match ID
 * @param {Object} statusData - Status data with parseStatus and optional parseError
 * @returns {Promise<Object>}
 */
export const updateMatchParseStatus = async (matchId, statusData) => {
  if (!matchId || typeof matchId !== 'string') {
    throw createHttpError(400, 'Invalid match ID');
  }

  if (!statusData.parseStatus) {
    throw createHttpError(400, 'parseStatus is required');
  }

  const validStatuses = ['pending', 'processing', 'completed', 'failed'];
  if (!validStatuses.includes(statusData.parseStatus)) {
    throw createHttpError(400, `parseStatus must be one of: ${validStatuses.join(', ')}`);
  }

  // Verify match exists
  const match = await getDemoMatchById(matchId);
  if (!match) {
    throw createHttpError(404, 'Match not found');
  }

  const assignments = [];
  const params = [{ name: 'matchId', type: TYPES.NVarChar, value: matchId }];

  assignments.push('[parseStatus] = @parseStatus');
  params.push({ name: 'parseStatus', type: TYPES.NVarChar, value: statusData.parseStatus });

  if (statusData.parseError !== undefined) {
    assignments.push('[parseError] = @parseError');
    params.push({ name: 'parseError', type: TYPES.NVarChar, value: statusData.parseError || null });
  }

  assignments.push('[updatedAt] = GETDATE()');

  const { rows } = await execute(
    `UPDATE ${TABLE} SET ${assignments.join(', ')} OUTPUT INSERTED.[id], INSERTED.[parseStatus], INSERTED.[parseError], INSERTED.[updatedAt] WHERE [id] = @matchId`,
    params
  );

  if (rows.length === 0) {
    throw createHttpError(404, 'Match not found');
  }

  const result = rowToObject(rows[0]);
  return {
    id: result.id,
    parseStatus: result.parseStatus,
    parseError: result.parseError || undefined,
    updatedAt: result.updatedAt ? result.updatedAt.toISOString() : null,
  };
};

export default {
  getDemoMatches,
  getDemoMatchById,
  getDemoMatchByIdPublic,
  getDemoMatchesByTournament,
  getDemoMatchesPublic,
  getDemoMatchesByTournamentPublic,
  createDemoMatch,
  updateDemoMatch,
  deleteDemoMatch,
  getDemoData,
  getDemoDataPublic,
  formatMatchDate,
  generateDisplayName,
  sanitizeFilenameComponent,
  upsertDemoMatch,
  upsertMatchPlayers,
  createMatchRounds,
  createRoundEvents,
  upsertMatchInsights,
  updateMatchParseStatus,
};
