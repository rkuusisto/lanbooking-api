import { createRemoteJWKSet, jwtVerify } from 'jose';
import config from '../config/config.js';

const requiredConfig = ['KEYCLOAK_BASE_URL', 'KEYCLOAK_REALM', 'KEYCLOAK_CLIENT_ID'];
const missing = requiredConfig.filter(key => !config[key]);

if (missing.length > 0) {
  throw new Error(
    `Missing Keycloak configuration values: ${missing.join(
      ', '
    )}. Please set them before starting the server.`
  );
}

const normalizedBaseUrl = config.KEYCLOAK_BASE_URL.replace(/\/+$/, '');
const issuer = `${normalizedBaseUrl}/realms/${config.KEYCLOAK_REALM}`;

// For JWKS fetching, handle different URL formats
// If using host.docker.internal, use as-is (works from containers to host)
// Otherwise, use keycloak service name for Docker network access
let jwksBaseUrl = normalizedBaseUrl;
if (!jwksBaseUrl.includes('host.docker.internal') && !jwksBaseUrl.includes('keycloak')) {
  // Replace localhost with keycloak for internal Docker network access
  jwksBaseUrl = jwksBaseUrl.replace(/localhost/, 'keycloak');
}
const jwksUri = `${jwksBaseUrl}/realms/${config.KEYCLOAK_REALM}/protocol/openid-connect/certs`;
console.log('[auth] JWKS URI:', jwksUri);
const remoteJwks = createRemoteJWKSet(new URL(jwksUri));

// Accept tokens from multiple issuer variants (localhost, keycloak, host.docker.internal)
const baseUrlVariants = [normalizedBaseUrl];
if (normalizedBaseUrl.includes('keycloak')) {
  baseUrlVariants.push(normalizedBaseUrl.replace('keycloak', 'localhost'));
  baseUrlVariants.push(normalizedBaseUrl.replace('keycloak', 'host.docker.internal'));
} else if (normalizedBaseUrl.includes('localhost')) {
  baseUrlVariants.push(normalizedBaseUrl.replace('localhost', 'keycloak'));
  baseUrlVariants.push(normalizedBaseUrl.replace('localhost', 'host.docker.internal'));
} else if (normalizedBaseUrl.includes('host.docker.internal')) {
  baseUrlVariants.push(normalizedBaseUrl.replace('host.docker.internal', 'localhost'));
  baseUrlVariants.push(normalizedBaseUrl.replace('host.docker.internal', 'keycloak'));
}
const allowedIssuers = baseUrlVariants.map(url => `${url}/realms/${config.KEYCLOAK_REALM}`);
console.log('[auth] Allowed issuers on startup:', allowedIssuers);

const configuredAudiences = (config.KEYCLOAK_AUDIENCE || '')
  .split(',')
  .map(entry => entry.trim())
  .filter(Boolean);

function hasRequiredRole(payload) {
  if (!config.KEYCLOAK_REQUIRED_ROLE) {
    return true;
  }
  
  const realmRoles = payload?.realm_access?.roles || [];
  const clientRoles =
    payload?.resource_access?.[config.KEYCLOAK_CLIENT_ID]?.roles || [];

  return (
    realmRoles.includes(config.KEYCLOAK_REQUIRED_ROLE) ||
    clientRoles.includes(config.KEYCLOAK_REQUIRED_ROLE)
  );
}

/**
 * Shared token verification logic
 * @param {string} token - JWT token
 * @returns {Promise<Object>} Verification result with success flag and payload or error
 */
async function verifyToken(token) {
  try {
    // First verify without issuer check to get the payload
    const { payload } = await jwtVerify(token, remoteJwks, {
      audience: configuredAudiences.length > 0 ? configuredAudiences : undefined
    });

    // Then validate the issuer manually to allow multiple issuer variants
    if (!allowedIssuers.includes(payload.iss)) {
      return { success: false, error: 'Invalid token issuer' };
    }

    if (!hasRequiredRole(payload)) {
      return { success: false, error: 'Insufficient role' };
    }

    return {
      success: true,
      payload: {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        roles: payload?.realm_access?.roles || [],
      }
    };
  } catch (error) {
    if (error.code === 'ERR_JWT_EXPIRED') {
      return { success: false, error: 'Token expired', code: 'expired' };
    }
    return { success: false, error: 'Invalid token', code: 'invalid' };
  }
}

/**
 * Required authentication middleware - rejects requests without valid token
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const token = authHeader.slice(7).trim();
  const result = await verifyToken(token);

  if (!result.success) {
    console.error('Authentication error:', result.error);
    return res.status(result.error === 'Insufficient role' ? 403 : 401).json({ 
      error: result.error 
    });
  }

  req.user = result.payload;
  return next();
}

/**
 * Optional authentication middleware - verifies token if present but doesn't fail if missing
 * Sets req.authenticated = true/false and req.user if authenticated
 */
export async function optionalAuth(req, res, next) {
  req.authenticated = false;
  req.user = null;

  const authHeader = req.headers.authorization || '';
  
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return next(); // No auth header, continue without authentication
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next(); // Empty token, continue without authentication
  }

  const result = await verifyToken(token);

  if (result.success) {
    req.authenticated = true;
    req.user = result.payload;
  }
  // If verification fails, continue without authentication (don't fail the request)
  
  return next();
}