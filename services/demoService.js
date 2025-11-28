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
  };

  // Remove undefined fields
  Object.keys(match).forEach(key => {
    if (match[key] === undefined) {
      delete match[key];
    }
  });

  return match;
}

function serializeRows(rows) {
  return rows.map(row => serializeRow(row));
}

/**
 * Validate demo match structure
 * @param {Object} match - Match object to validate
 * @returns {boolean}
 */
function validateMatch(match) {
  const requiredFields = ['id', 'tournamentId', 'event', 'stage', 'fileName', 'fileSizeMB', 'map', 'bestOf', 'playedAt', 'teams'];
  
  for (const field of requiredFields) {
    if (match[field] === undefined || match[field] === null) {
      return false;
    }
  }
  
  // Validate teams array
  if (!Array.isArray(match.teams) || match.teams.length !== 2) {
    return false;
  }
  
  // Validate each team
  for (const team of match.teams) {
    if (!team.name || typeof team.score !== 'number' || !Array.isArray(team.players)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get all demo matches
 * @returns {Promise<Array>}
 */
export const getDemoMatches = async () => {
  const { rows } = await execute(
    `SELECT * FROM ${TABLE} ORDER BY [playedAt] DESC`
  );
  return serializeRows(rows);
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
 * Get all matches for a specific tournament
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<Array>}
 */
export const getDemoMatchesByTournament = async (tournamentId) => {
  if (!tournamentId || typeof tournamentId !== 'string') {
    return [];
  }
  
  const { rows } = await execute(
    `SELECT * FROM ${TABLE} WHERE [tournamentId] = @tournamentId ORDER BY [playedAt] DESC`,
    [{ name: 'tournamentId', type: TYPES.NVarChar, value: tournamentId }]
  );
  return serializeRows(rows);
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
    { name: 'fileName', type: TYPES.NVarChar, value: matchData.fileName },
    { name: 'fileSizeMB', type: TYPES.Float, value: matchData.fileSizeMB },
    { name: 'map', type: TYPES.NVarChar, value: matchData.map },
    { name: 'bestOf', type: TYPES.Int, value: matchData.bestOf },
    { name: 'playedAt', type: TYPES.DateTime, value: playedAtDate },
    { name: 'teams', type: TYPES.NVarChar, value: teamsJson },
  ];
  
  if (matchData.displayName) {
    params.push({ name: 'displayName', type: TYPES.NVarChar, value: matchData.displayName });
  }
  
  if (highlightsJson) {
    params.push({ name: 'highlights', type: TYPES.NVarChar, value: highlightsJson });
  }
  
  if (matchData.durationMinutes !== undefined && matchData.durationMinutes !== null) {
    params.push({ name: 'durationMinutes', type: TYPES.Int, value: matchData.durationMinutes });
  }
  
  if (matchData.rounds !== undefined && matchData.rounds !== null) {
    params.push({ name: 'rounds', type: TYPES.Int, value: matchData.rounds });
  }
  
  if (matchData.notes) {
    params.push({ name: 'notes', type: TYPES.NVarChar, value: matchData.notes });
  }
  
  const columns = [
    '[id]', '[tournamentId]', '[event]', '[stage]', '[fileName]', 
    '[fileSizeMB]', '[map]', '[bestOf]', '[playedAt]', '[teams]'
  ];
  const values = [
    '@id', '@tournamentId', '@event', '@stage', '@fileName',
    '@fileSizeMB', '@map', '@bestOf', '@playedAt', '@teams'
  ];
  
  if (matchData.displayName) {
    columns.push('[displayName]');
    values.push('@displayName');
  }
  
  if (highlightsJson) {
    columns.push('[highlights]');
    values.push('@highlights');
  }
  
  if (matchData.durationMinutes !== undefined && matchData.durationMinutes !== null) {
    columns.push('[durationMinutes]');
    values.push('@durationMinutes');
  }
  
  if (matchData.rounds !== undefined && matchData.rounds !== null) {
    columns.push('[rounds]');
    values.push('@rounds');
  }
  
  if (matchData.notes) {
    columns.push('[notes]');
    values.push('@notes');
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
 * @returns {Promise<Object>}
 */
export const getDemoData = async () => {
  const matches = await getDemoMatches();
  return {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    matches,
  };
};

export default {
  getDemoMatches,
  getDemoMatchById,
  getDemoMatchesByTournament,
  createDemoMatch,
  updateDemoMatch,
  deleteDemoMatch,
  getDemoData,
  formatMatchDate,
  generateDisplayName,
  sanitizeFilenameComponent,
};
