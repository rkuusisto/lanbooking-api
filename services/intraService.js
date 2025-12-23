import { Request, TYPES } from 'tedious';
import azureSqlConnection from '../utils/azureSqlConnection.js';
import { v4 as uuidv4 } from 'uuid';
import { normalizePhone } from '../utils/phoneUtils.js';

const TABLES = {
  REGISTRATION: '[Lanregistration]',
  BOOKING: '[Lanbooking]',
  SETTINGS: '[LanSettings]',
  CONTACTS: '[contacts]',
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
  registrationEnabled: field('RegistrationEnabled', TYPES.Bit, { boolean: true }),
  bookingEnabled: field('BookingEnabled', TYPES.Bit, { boolean: true }),
  attendancePerDayEnabled: field('AttendancePerDayEnabled', TYPES.Bit, { boolean: true }),
  foodEnabled: field('FoodEnabled', TYPES.Bit, { boolean: true }),
  announcement: field('Announcement', TYPES.NVarChar),
  appTitle: field('app_title', TYPES.NVarChar),
  organizerName: field('organizer_name', TYPES.NVarChar),
  venueName: field('venue_name', TYPES.NVarChar),
  venueAddress: field('venue_address', TYPES.NVarChar),
  logoPath: field('logo_path', TYPES.NVarChar),
  linksWebsite: field('links_website', TYPES.NVarChar),
  pricingStandardSeatPrice: field('pricing_standard_seat_price', TYPES.Decimal),
  pricingPremiumSeatPrice: field('pricing_premium_seat_price', TYPES.Decimal),
  pricingStandardSeatDimensions: field('pricing_standard_seat_dimensions', TYPES.NVarChar),
  pricingPremiumSeatDimensions: field('pricing_premium_seat_dimensions', TYPES.NVarChar),
  pricingStandardSeatLabel: field('pricing_standard_seat_label', TYPES.NVarChar),
  pricingPremiumSeatLabel: field('pricing_premium_seat_label', TYPES.NVarChar),
  paymentMobilePayNumber: field('payment_mobile_pay_number', TYPES.NVarChar),
  paymentBankAccount: field('payment_bank_account', TYPES.NVarChar),
  paymentBankAccountHolder: field('payment_bank_account_holder', TYPES.NVarChar),
  paymentInstructions: field('payment_instructions', TYPES.NVarChar),
  createdAt: field('CreatedAt', TYPES.DateTime, {
    readOnly: true,
    formatter: value => (value ? value.toISOString() : null),
  }),
  updatedAt: field('UpdatedAt', TYPES.DateTime, {
    readOnly: true,
    formatter: value => (value ? value.toISOString() : null),
  }),
};

const CONTACT_FIELDS = {
  role: field('role', TYPES.NVarChar, { required: true }),
  name: field('name', TYPES.NVarChar, { required: true }),
  phone: field('phone', TYPES.NVarChar),
  email: field('email', TYPES.NVarChar),
  notes: field('notes', TYPES.NVarChar),
  displayOrder: field('display_order', TYPES.Int),
  isPublic: field('is_public', TYPES.Bit, { boolean: true }),
  createdAt: field('created_at', TYPES.DateTime, {
    readOnly: true,
    formatter: value => (value ? value.toISOString() : null),
  }),
  updatedAt: field('updated_at', TYPES.DateTime, {
    readOnly: true,
    formatter: value => (value ? value.toISOString() : null),
  }),
};

const columnLookups = {
  registration: buildLookup(REGISTRATION_FIELDS),
  booking: buildLookup(BOOKING_FIELDS),
  settings: buildLookup(SETTINGS_FIELDS),
  contacts: buildLookup(CONTACT_FIELDS),
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

  if (cfg.type === TYPES.Decimal) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw createHttpError(400, `Invalid decimal number for ${key}`);
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

function validateEmail(email) {
  if (!email) return true; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw createHttpError(400, 'Invalid email format');
  }
  return true;
}

function validateUrl(url) {
  if (!url) return true; // Optional field
  try {
    new URL(url);
    return true;
  } catch {
    throw createHttpError(400, 'Invalid URL format');
  }
}

function validatePhone(phone) {
  if (!phone) return null; // Optional field
  
  // Normalize the phone number
  const normalized = normalizePhone(phone);
  
  // Validation: must start with +, followed by 1-3 digit country code, then more digits
  const phoneRegex = /^\+\d{1,3}\d+$/;
  if (!phoneRegex.test(normalized)) {
    throw createHttpError(400, 'Invalid phone number format');
  }
  
  return normalized;
}

function validateIban(iban) {
  if (!iban) return true; // Optional field
  // Basic IBAN validation - should start with 2 letters followed by digits
  const ibanRegex = /^[A-Z]{2}\d{2}[\dA-Z\s]+$/i;
  if (!ibanRegex.test(iban)) {
    throw createHttpError(400, 'Invalid IBAN format');
  }
  return true;
}

function validateSettings(payload) {
  // Validate eventName length
  if (payload.eventName && payload.eventName.length > 255) {
    throw createHttpError(400, 'eventName must be 255 characters or less');
  }

  // Validate dates
  if (payload.startDate && payload.endDate) {
    const start = new Date(payload.startDate);
    const end = new Date(payload.endDate);
    if (end < start) {
      throw createHttpError(400, 'endDate must be greater than or equal to startDate');
    }
  }

  // Validate pricing
  if (payload.pricingStandardSeatPrice !== undefined && payload.pricingStandardSeatPrice < 0) {
    throw createHttpError(400, 'pricingStandardSeatPrice must be >= 0');
  }
  if (payload.pricingPremiumSeatPrice !== undefined && payload.pricingPremiumSeatPrice < 0) {
    throw createHttpError(400, 'pricingPremiumSeatPrice must be >= 0');
  }

  // Validate URLs
  if (payload.linksWebsite) {
    validateUrl(payload.linksWebsite);
  }

  // Validate IBAN
  if (payload.paymentBankAccount) {
    validateIban(payload.paymentBankAccount);
  }
}

function validateContact(contact) {
  // Validate role length
  if (contact.role && contact.role.length > 50) {
    throw createHttpError(400, 'role must be 50 characters or less');
  }

  // Validate name length
  if (contact.name && contact.name.length > 255) {
    throw createHttpError(400, 'name must be 255 characters or less');
  }

  // Validate email
  if (contact.email) {
    validateEmail(contact.email);
  }

  // Validate and normalize phone
  if (contact.phone) {
    contact.phone = validatePhone(contact.phone);
  }

  // Validate displayOrder
  if (contact.displayOrder !== undefined && contact.displayOrder < 0) {
    throw createHttpError(400, 'displayOrder must be >= 0');
  }
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

async function createBooking(payload) {
  const data = {
    invitationSent: payload.invitationSent ?? false,
    done: payload.done ?? 0,
    ...payload,
  };

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

async function updateBooking(id, payload) {
  const safeId = ensureId(id);
  const { assignments, params } = buildUpdateParts(payload, BOOKING_FIELDS);

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
  const entities = serializeRows(rows, SETTINGS_FIELDS, columnLookups.settings);
  
  // Add contacts to each setting
  for (const setting of entities) {
    setting.contacts = await getContactsBySettingsId(setting.id, true);
  }
  
  return entities;
}

async function getSettingById(id) {
  const safeId = ensureId(id);
  const { rows } = await execute(
    `SELECT * FROM ${TABLES.SETTINGS} WHERE Id = @id`,
    [{ name: 'id', type: TYPES.Int, value: Number(safeId) }]
  );
  const entities = serializeRows(rows, SETTINGS_FIELDS, columnLookups.settings);
  const setting = entities[0] || null;
  
  if (setting) {
    setting.contacts = await getContactsBySettingsId(setting.id, true);
  }
  
  return setting;
}

async function getContactsBySettingsId(settingsId, includePrivate = true) {
  const params = [{ name: 'settingsId', type: TYPES.Int, value: Number(settingsId) }];
  let query = `SELECT * FROM ${TABLES.CONTACTS} WHERE settings_id = @settingsId`;
  
  if (!includePrivate) {
    query += ' AND is_public = 1';
  }
  
  query += ' ORDER BY display_order ASC';
  
  const { rows } = await execute(query, params);
  return serializeRows(rows, CONTACT_FIELDS, columnLookups.contacts);
}

async function createContacts(settingsId, contacts) {
  if (!contacts || contacts.length === 0) {
    return [];
  }

  // Create contacts one by one to avoid parameter name conflicts
  const createdContacts = [];
  
  for (const contact of contacts) {
    ensureRequiredFields(contact, CONTACT_FIELDS);
    
    const contactId = uuidv4();
    const { columns, values, params } = buildInsertParts(contact, CONTACT_FIELDS);
    
    if (columns.length === 0) {
      throw createHttpError(400, 'Contact has no valid fields');
    }

    // Add id and settings_id
    columns.unshift('[id]', '[settings_id]');
    values.unshift('@id', '@settingsId');
    params.unshift(
      { name: 'id', type: TYPES.NVarChar, value: contactId },
      { name: 'settingsId', type: TYPES.Int, value: Number(settingsId) }
    );

    // Add timestamp columns
    columns.push('[created_at]', '[updated_at]');
    values.push('SYSDATETIME()', 'SYSDATETIME()');

    const query = `INSERT INTO ${TABLES.CONTACTS} (${columns.join(
      ', '
    )}) OUTPUT INSERTED.* VALUES (${values.join(', ')});`;

    const { rows } = await execute(query, params);
    const entities = serializeRows(rows, CONTACT_FIELDS, columnLookups.contacts);
    createdContacts.push(entities[0]);
  }

  return createdContacts;
}

async function deleteContactsBySettingsId(settingsId) {
  const { rowCount } = await execute(
    `DELETE FROM ${TABLES.CONTACTS} WHERE settings_id = @settingsId`,
    [{ name: 'settingsId', type: TYPES.Int, value: Number(settingsId) }]
  );
  return rowCount;
}

async function getLatestSetting() {
  const { rows } = await execute(
    `SELECT TOP 1 * FROM ${TABLES.SETTINGS} ORDER BY Id DESC`
  );
  const entities = serializeRows(rows, SETTINGS_FIELDS, columnLookups.settings);
  const setting = entities[0] || null;
  
  if (setting) {
    setting.contacts = await getContactsBySettingsId(setting.id, true);
  }
  
  return setting;
}

async function createSetting(payload) {
  const { contacts, ...settingsData } = payload;
  
  // Validate settings
  validateSettings(settingsData);
  
  ensureRequiredFields(settingsData, SETTINGS_FIELDS);
  const { columns, values, params } = buildInsertParts(settingsData, SETTINGS_FIELDS);

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
  const setting = entities[0];
  
  // Create contacts if provided
  if (contacts && Array.isArray(contacts) && contacts.length > 0) {
    // Validate all contacts
    contacts.forEach(validateContact);
    setting.contacts = await createContacts(setting.id, contacts);
  } else {
    setting.contacts = [];
  }
  
  return setting;
}

async function updateSetting(id, payload) {
  const safeId = ensureId(id);
  const { contacts, ...settingsData } = payload;
  
  // Validate settings
  validateSettings(settingsData);
  
  const { assignments, params } = buildUpdateParts(settingsData, SETTINGS_FIELDS);

  if (assignments.length === 0 && (!contacts || contacts.length === 0)) {
    throw createHttpError(400, 'No fields provided for update');
  }

  // Update settings if there are any changes
  if (assignments.length > 0) {
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
  } else {
    // Verify settings exists
    const existing = await getSettingById(safeId);
    if (!existing) {
      return null;
    }
  }

  // Replace all contacts (Option A from documentation)
  if (contacts !== undefined) {
    // Validate all contacts
    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      contacts.forEach(validateContact);
    }
    await deleteContactsBySettingsId(safeId);
    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      await createContacts(safeId, contacts);
    }
  }

  // Fetch updated settings with contacts
  return await getSettingById(safeId);
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
  deleteBooking,
  getSettings,
  getSettingById,
  getLatestSetting,
  createSetting,
  updateSetting,
  deleteSetting,
};
