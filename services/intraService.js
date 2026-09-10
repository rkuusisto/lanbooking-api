import { Request, TYPES } from 'tedious';
import azureSqlConnection from '../utils/azureSqlConnection.js';

const TABLES = {
  REGISTRATION: '[Lanregistration]',
  BOOKING: '[Lanbooking]',
  SETTINGS: '[LanSettings]',
  BLOCKED: '[BlockedLocations]',
};

const field = (column, type, options = {}) => ({
  column,
  type,
  required: options.required || false,
  boolean: options.boolean || false,
  readOnly: options.readOnly || false,
  formatter: options.formatter,
});

const REGISTRATION_FIELDS = {
  firstname: field('Firstname', TYPES.NVarChar, { required: true }),
  lastname: field('Lastname', TYPES.NVarChar, { required: true }),
  phone: field('Phone', TYPES.NVarChar),
  email: field('Email', TYPES.NVarChar, { required: true }),
  parentName: field('ParentName', TYPES.NVarChar),
  parentPhone: field('ParentPhone', TYPES.NVarChar),
  devicePc: field('DevicePC', TYPES.Bit, { boolean: true }),
  deviceConsole: field('DeviceConsole', TYPES.Bit, { boolean: true }),
  deviceHanging: field('DeviceHanging', TYPES.Bit, { boolean: true }),
  deviceOther: field('DeviceOther', TYPES.Bit, { boolean: true }),
  deviceOtherComment: field('DeviceOtherComment', TYPES.NVarChar),
  attendingThu: field('AttendingThu', TYPES.Bit, { boolean: true }),
  attendingFri: field('AttendingFri', TYPES.Bit, { boolean: true }),
  tournamentBS: field('TournamentBS', TYPES.Bit, { boolean: true }),
  tournamentOW: field('TournamentOW', TYPES.Bit, { boolean: true }),
  tournamentLOL: field('TournamentLOL', TYPES.Bit, { boolean: true }),
  tournamentMC: field('TournamentMC', TYPES.Bit, { boolean: true }),
  tournamentCS: field('TournamentCS', TYPES.Bit, { boolean: true }),
  tournamentTetris: field('TournamentTetris', TYPES.Bit, { boolean: true }),
  tournamentTableFB: field('TournamentTableFB', TYPES.Bit, { boolean: true }),
  tournamentTableTennis: field('TournamentTableTennis', TYPES.Bit, { boolean: true }),
  tournamentBiljard: field('TournamentBiljard', TYPES.Bit, { boolean: true }),
  tournamentOther: field('TournamentOther', TYPES.Bit, { boolean: true }),
  tournamentOtherComment: field('TournamentOtherComment', TYPES.NVarChar),
  food: field('Food', TYPES.Bit, { boolean: true }),
  diet: field('Diet', TYPES.Bit, { boolean: true }),
  dietL: field('DietL', TYPES.Bit, { boolean: true }),
  dietG: field('DietG', TYPES.Bit, { boolean: true }),
  dietV: field('DietV', TYPES.Bit, { boolean: true }),
  dietOther: field('DietOther', TYPES.Bit, { boolean: true }),
  dietOtherComment: field('DietOtherComment', TYPES.NVarChar),
  nickname: field('Nickname', TYPES.NVarChar),
  steamId: field('SteamID', TYPES.NVarChar),
  feedback: field('Feedback', TYPES.NVarChar),
  history: field('History', TYPES.Int),
};

const BOOKING_FIELDS = {
  email: field('Email', TYPES.NVarChar, { required: true }),
  code: field('Code', TYPES.NVarChar, { required: true }),
  location: field('Location', TYPES.NVarChar),
  invitationSent: field('InvitationSent', TYPES.Bit, { boolean: true }),
  done: field('Done', TYPES.Int),
};

const BLOCKED_FIELDS = {
  location: field('Location', TYPES.NVarChar, { required: true }),
  createdAt: field('CreatedAt', TYPES.DateTime, {
    readOnly: true,
    formatter: value => (value ? value.toISOString() : null),
  }),
};

const SETTINGS_FIELDS = {
  total: field('Total', TYPES.Int, { required: true }),
  startDate: field('StartDate', TYPES.Date, {
    required: true,
    formatter: value => (value ? value.toISOString().split('T')[0] : null),
  }),
  endDate: field('EndDate', TYPES.Date, {
    required: true,
    formatter: value => (value ? value.toISOString().split('T')[0] : null),
  }),
  eventName: field('EventName', TYPES.NVarChar, { required: true }),
  attendancePerDayEnabled: field('AttendancePerDayEnabled', TYPES.Bit, { boolean: true }),
  foodEnabled: field('FoodEnabled', TYPES.Bit, { boolean: true }),
  createdAt: field('CreatedAt', TYPES.DateTime, {
    readOnly: true,
    formatter: value => (value ? value.toISOString() : null),
  }),
  updatedAt: field('UpdatedAt', TYPES.DateTime, {
    readOnly: true,
    formatter: value => (value ? value.toISOString() : null),
  }),
};

const columnLookups = {
  registration: buildLookup(REGISTRATION_FIELDS),
  booking: buildLookup(BOOKING_FIELDS),
  settings: buildLookup(SETTINGS_FIELDS),
  blocked: buildLookup(BLOCKED_FIELDS),
};

function buildLookup(map) {
  return Object.entries(map).reduce((acc, [key, cfg]) => {
    acc[cfg.column.toLowerCase()] = key;
    return acc;
  }, {});
}

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

function toCamelCase(value) {
  if (!value) {
    return value;
  }
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function serializeRows(rows, fieldMap, lookup) {
  return rows.map(row => {
    const raw = rowToObject(row);
    const entity = {};

    Object.entries(raw).forEach(([column, value]) => {
      if (column.toLowerCase() === 'id') {
        entity.id = value === null || value === undefined ? null : String(value);
        return;
      }

      const apiKey = lookup[column.toLowerCase()];
      if (apiKey) {
        const cfg = fieldMap[apiKey];
        entity[apiKey] = serializeValue(value, cfg);
      } else {
        entity[toCamelCase(column)] =
          value instanceof Date ? value.toISOString() : value;
      }
    });

    return entity;
  });
}

function serializeValue(value, cfg) {
  if (value === null || value === undefined) {
    return value;
  }

  if (cfg.boolean) {
    return Boolean(value);
  }

  if (cfg.formatter) {
    return cfg.formatter(value);
  }

  return value;
}

function ensureRequiredFields(payload, fieldMap) {
  const missing = Object.entries(fieldMap)
    .filter(([, cfg]) => cfg.required && cfg.readOnly !== true)
    .filter(([key]) => payload[key] === undefined)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw createHttpError(
      400,
      `Missing required fields: ${missing.sort().join(', ')}`
    );
  }
}

function normalizeBooleanValue(value, key) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 1 || value === '1') {
    return true;
  }
  if (value === 0 || value === '0') {
    return false;
  }
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    if (lowered === 'true') {
      return true;
    }
    if (lowered === 'false') {
      return false;
    }
  }
  throw createHttpError(400, `Invalid boolean value for ${key}`);
}

function transformInputValue(value, cfg, key) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (cfg.boolean) {
    return normalizeBooleanValue(value, key);
  }

  if (cfg.type === TYPES.Int) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw createHttpError(400, `Invalid number for ${key}`);
    }
    return parsed;
  }

  if (cfg.type === TYPES.BigInt) {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (!/^-?\d+$/.test(String(value))) {
      throw createHttpError(400, `Invalid identifier for ${key}`);
    }
    return String(value);
  }

  if (cfg.type === TYPES.Date || cfg.type === TYPES.DateTime) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw createHttpError(400, `Invalid date for ${key}`);
    }
    return date;
  }

  return value;
}

function buildInsertParts(payload, fieldMap) {
  const columns = [];
  const values = [];
  const params = [];

  Object.entries(fieldMap).forEach(([key, cfg]) => {
    if (cfg.readOnly) {
      return;
    }
    const transformed = transformInputValue(payload[key], cfg, key);
    if (transformed === undefined) {
      return;
    }

    const paramName = `${key}`;
    columns.push(`[${cfg.column}]`);
    values.push(`@${paramName}`);
    params.push({ name: paramName, type: cfg.type, value: transformed });
  });

  return { columns, values, params };
}

function buildUpdateParts(payload, fieldMap) {
  const assignments = [];
  const params = [];

  Object.entries(fieldMap).forEach(([key, cfg]) => {
    if (cfg.readOnly) {
      return;
    }
    if (payload[key] === undefined) {
      return;
    }

    const transformed = transformInputValue(payload[key], cfg, key);
    const paramName = `${key}`;
    assignments.push(`[${cfg.column}] = @${paramName}`);
    params.push({ name: paramName, type: cfg.type, value: transformed });
  });

  return { assignments, params };
}

function ensureId(value) {
  if (value === undefined || value === null) {
    throw createHttpError(400, 'Id is required');
  }
  if (!/^\d+$/.test(String(value))) {
    throw createHttpError(400, 'Id must be a positive integer');
  }
  return String(value);
}

async function getRegistrations() {
  const { rows } = await execute(
    `SELECT * FROM ${TABLES.REGISTRATION} ORDER BY Id DESC`
  );
  return serializeRows(rows, REGISTRATION_FIELDS, columnLookups.registration);
}

async function getRegistrationById(id) {
  const safeId = ensureId(id);
  const { rows } = await execute(
    `SELECT * FROM ${TABLES.REGISTRATION} WHERE Id = @id`,
    [{ name: 'id', type: TYPES.BigInt, value: safeId }]
  );
  const entities = serializeRows(
    rows,
    REGISTRATION_FIELDS,
    columnLookups.registration
  );
  return entities[0] || null;
}

async function createRegistration(payload) {
  ensureRequiredFields(payload, REGISTRATION_FIELDS);
  const { columns, values, params } = buildInsertParts(
    payload,
    REGISTRATION_FIELDS
  );

  if (columns.length === 0) {
    throw createHttpError(400, 'No registration fields provided');
  }

  const query = `INSERT INTO ${TABLES.REGISTRATION} (${columns.join(
    ', '
  )}) OUTPUT INSERTED.* VALUES (${values.join(', ')});`;

  const { rows } = await execute(query, params);
  const entities = serializeRows(
    rows,
    REGISTRATION_FIELDS,
    columnLookups.registration
  );
  return entities[0];
}

async function updateRegistration(id, payload) {
  const safeId = ensureId(id);
  const { assignments, params } = buildUpdateParts(payload, REGISTRATION_FIELDS);

  if (assignments.length === 0) {
    throw createHttpError(400, 'No fields provided for update');
  }

  params.push({ name: 'id', type: TYPES.BigInt, value: safeId });

  const query = `UPDATE ${TABLES.REGISTRATION}
    SET ${assignments.join(', ')}
    OUTPUT INSERTED.*
    WHERE Id = @id;`;

  const { rows, rowCount } = await execute(query, params);

  if (rowCount === 0) {
    return null;
  }

  return serializeRows(rows, REGISTRATION_FIELDS, columnLookups.registration)[0];
}

async function deleteRegistration(id) {
  const safeId = ensureId(id);
  const query = `DELETE FROM ${TABLES.REGISTRATION} OUTPUT DELETED.Id WHERE Id = @id;`;
  const { rowCount } = await execute(query, [
    { name: 'id', type: TYPES.BigInt, value: safeId },
  ]);
  return rowCount > 0;
}

async function getBookings() {
  const { rows } = await execute(
    `SELECT * FROM ${TABLES.BOOKING} ORDER BY Id DESC`
  );
  return serializeRows(rows, BOOKING_FIELDS, columnLookups.booking);
}

async function getBookingById(id) {
  const safeId = ensureId(id);
  const { rows } = await execute(
    `SELECT * FROM ${TABLES.BOOKING} WHERE Id = @id`,
    [{ name: 'id', type: TYPES.BigInt, value: safeId }]
  );
  const entities = serializeRows(rows, BOOKING_FIELDS, columnLookups.booking);
  return entities[0] || null;
}

function normalizeLocation(value) {
  if (value === undefined || value === null) {
    return value;
  }
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === '-') {
    return null;
  }
  return trimmed;
}

async function assertLocationAvailable(location, excludeBookingId) {
  const normalized = normalizeLocation(location);
  if (normalized === undefined || normalized === null) {
    return;
  }

  const params = [
    { name: 'location', type: TYPES.NVarChar, value: normalized },
  ];
  let query = `SELECT Id FROM ${TABLES.BOOKING} WHERE [Location] = @location`;
  if (excludeBookingId) {
    query += ' AND Id != @excludeId';
    params.push({
      name: 'excludeId',
      type: TYPES.BigInt,
      value: excludeBookingId,
    });
  }

  const { rowCount } = await execute(query, params);
  if (rowCount > 0) {
    throw createHttpError(409, 'Location already booked');
  }
}

async function createBooking(payload) {
  const data = {
    invitationSent: payload.invitationSent ?? false,
    done: payload.done ?? 0,
    ...payload,
  };

  if (data.location !== undefined) {
    data.location = normalizeLocation(data.location);
    await assertLocationAvailable(data.location);
  }

  ensureRequiredFields(data, BOOKING_FIELDS);
  const { columns, values, params } = buildInsertParts(data, BOOKING_FIELDS);

  if (columns.length === 0) {
    throw createHttpError(400, 'No booking fields provided');
  }

  const query = `INSERT INTO ${TABLES.BOOKING} (${columns.join(
    ', '
  )}) OUTPUT INSERTED.* VALUES (${values.join(', ')});`;

  const { rows } = await execute(query, params);
  const entities = serializeRows(rows, BOOKING_FIELDS, columnLookups.booking);
  return entities[0];
}

async function setBookingLocation(id, location) {
  const safeId = ensureId(id);
  const normalized = normalizeLocation(location);
  const { rows, rowCount } = await execute(
    `UPDATE ${TABLES.BOOKING} SET [Location] = @location OUTPUT INSERTED.* WHERE Id = @id`,
    [
      { name: 'location', type: TYPES.NVarChar, value: normalized },
      { name: 'id', type: TYPES.BigInt, value: safeId },
    ]
  );
  if (rowCount === 0) {
    return null;
  }
  return serializeRows(rows, BOOKING_FIELDS, columnLookups.booking)[0];
}

async function swapBookingLocations(sourceId, targetLocation) {
  const source = await getBookingById(sourceId);
  if (!source) {
    return null;
  }

  const target = normalizeLocation(targetLocation);
  if (!target) {
    throw createHttpError(400, 'Location is required');
  }

  if (normalizeLocation(source.location) === target) {
    throw createHttpError(400, 'Cannot swap a booking with its own location');
  }

  const { rows } = await execute(
    `SELECT * FROM ${TABLES.BOOKING} WHERE [Location] = @location AND Id != @id`,
    [
      { name: 'location', type: TYPES.NVarChar, value: target },
      { name: 'id', type: TYPES.BigInt, value: ensureId(sourceId) },
    ]
  );
  const occupants = serializeRows(rows, BOOKING_FIELDS, columnLookups.booking);
  const occupant = occupants[0] || null;

  if (!occupant) {
    return { source: await setBookingLocation(sourceId, target), target: null };
  }

  const sourceOld = normalizeLocation(source.location);
  await setBookingLocation(occupant.id, null);
  const updatedSource = await setBookingLocation(sourceId, target);
  const updatedOccupant = await setBookingLocation(occupant.id, sourceOld);
  return { source: updatedSource, target: updatedOccupant };
}

async function updateBooking(id, payload) {
  const safeId = ensureId(id);
  const data = { ...payload };
  if (data.location !== undefined) {
    data.location = normalizeLocation(data.location);
    await assertLocationAvailable(data.location, safeId);
  }
  const { assignments, params } = buildUpdateParts(data, BOOKING_FIELDS);

  if (assignments.length === 0) {
    throw createHttpError(400, 'No fields provided for update');
  }

  params.push({ name: 'id', type: TYPES.BigInt, value: safeId });

  const query = `UPDATE ${TABLES.BOOKING}
    SET ${assignments.join(', ')}
    OUTPUT INSERTED.*
    WHERE Id = @id;`;

  const { rows, rowCount } = await execute(query, params);

  if (rowCount === 0) {
    return null;
  }

  return serializeRows(rows, BOOKING_FIELDS, columnLookups.booking)[0];
}

async function getBlockedLocations() {
  const { rows } = await execute(
    `SELECT * FROM ${TABLES.BLOCKED} ORDER BY [Location]`
  );
  return serializeRows(rows, BLOCKED_FIELDS, columnLookups.blocked);
}

async function createBlockedLocation(payload) {
  const location = normalizeLocation(payload?.location);
  if (!location) {
    throw createHttpError(400, 'Location is required');
  }

  const existing = await execute(
    `SELECT Id FROM ${TABLES.BLOCKED} WHERE [Location] = @location`,
    [{ name: 'location', type: TYPES.NVarChar, value: location }]
  );
  if (existing.rowCount > 0) {
    throw createHttpError(409, 'Location is already blocked');
  }

  const query = `INSERT INTO ${TABLES.BLOCKED} ([Location]) OUTPUT INSERTED.* VALUES (@location);`;
  const { rows } = await execute(query, [
    { name: 'location', type: TYPES.NVarChar, value: location },
  ]);
  return serializeRows(rows, BLOCKED_FIELDS, columnLookups.blocked)[0];
}

async function deleteBlockedLocation(location) {
  const normalized = normalizeLocation(location);
  if (!normalized) {
    throw createHttpError(400, 'Location is required');
  }

  const { rowCount } = await execute(
    `DELETE FROM ${TABLES.BLOCKED} OUTPUT DELETED.Id WHERE [Location] = @location`,
    [{ name: 'location', type: TYPES.NVarChar, value: normalized }]
  );
  return rowCount > 0;
}

async function deleteBooking(id) {
  const safeId = ensureId(id);
  const query = `DELETE FROM ${TABLES.BOOKING} OUTPUT DELETED.Id WHERE Id = @id;`;
  const { rowCount } = await execute(query, [
    { name: 'id', type: TYPES.BigInt, value: safeId },
  ]);
  return rowCount > 0;
}

async function getSettings() {
  const { rows } = await execute(
    `SELECT * FROM ${TABLES.SETTINGS} ORDER BY Id DESC`
  );
  return serializeRows(rows, SETTINGS_FIELDS, columnLookups.settings);
}

async function getSettingById(id) {
  const safeId = ensureId(id);
  const { rows } = await execute(
    `SELECT * FROM ${TABLES.SETTINGS} WHERE Id = @id`,
    [{ name: 'id', type: TYPES.Int, value: Number(safeId) }]
  );
  const entities = serializeRows(rows, SETTINGS_FIELDS, columnLookups.settings);
  return entities[0] || null;
}

async function getLatestSetting() {
  const { rows } = await execute(
    `SELECT TOP 1 * FROM ${TABLES.SETTINGS} ORDER BY Id DESC`
  );
  const entities = serializeRows(rows, SETTINGS_FIELDS, columnLookups.settings);
  return entities[0] || null;
}

async function createSetting(payload) {
  ensureRequiredFields(payload, SETTINGS_FIELDS);
  const { columns, values, params } = buildInsertParts(payload, SETTINGS_FIELDS);

  if (columns.length === 0) {
    throw createHttpError(400, 'No settings fields provided');
  }

  columns.push('[CreatedAt]', '[UpdatedAt]');
  values.push('SYSDATETIME()', 'SYSDATETIME()');

  const query = `INSERT INTO ${TABLES.SETTINGS} (${columns.join(
    ', '
  )}) OUTPUT INSERTED.* VALUES (${values.join(', ')});`;

  const { rows } = await execute(query, params);
  const entities = serializeRows(rows, SETTINGS_FIELDS, columnLookups.settings);
  return entities[0];
}

async function updateSetting(id, payload) {
  const safeId = ensureId(id);
  const { assignments, params } = buildUpdateParts(payload, SETTINGS_FIELDS);

  if (assignments.length === 0) {
    throw createHttpError(400, 'No fields provided for update');
  }

  assignments.push('[UpdatedAt] = SYSDATETIME()');
  params.push({ name: 'id', type: TYPES.Int, value: Number(safeId) });

  const query = `UPDATE ${TABLES.SETTINGS}
    SET ${assignments.join(', ')}
    OUTPUT INSERTED.*
    WHERE Id = @id;`;

  const { rows, rowCount } = await execute(query, params);

  if (rowCount === 0) {
    return null;
  }

  return serializeRows(rows, SETTINGS_FIELDS, columnLookups.settings)[0];
}

async function deleteSetting(id) {
  const safeId = ensureId(id);
  const query = `DELETE FROM ${TABLES.SETTINGS} OUTPUT DELETED.Id WHERE Id = @id;`;
  const { rowCount } = await execute(query, [
    { name: 'id', type: TYPES.Int, value: Number(safeId) },
  ]);
  return rowCount > 0;
}

export default {
  getRegistrations,
  getRegistrationById,
  createRegistration,
  updateRegistration,
  deleteRegistration,
  getBookings,
  getBookingById,
  createBooking,
  updateBooking,
  swapBookingLocations,
  deleteBooking,
  getBlockedLocations,
  createBlockedLocation,
  deleteBlockedLocation,
  getSettings,
  getSettingById,
  getLatestSetting,
  createSetting,
  updateSetting,
  deleteSetting,
};
