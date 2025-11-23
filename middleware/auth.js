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

// For JWKS fetching, always use keycloak service name (works in Docker network)
// Replace localhost with keycloak for internal Docker network access
const jwksBaseUrl = normalizedBaseUrl.replace(/localhost/, 'keycloak');
const jwksUri = `${jwksBaseUrl}/realms/${config.KEYCLOAK_REALM}/protocol/openid-connect/certs`;
const remoteJwks = createRemoteJWKSet(new URL(jwksUri));

// Accept tokens from both localhost (browser perspective) and keycloak (Docker internal) issuers
const baseUrlVariants = [normalizedBaseUrl];
if (normalizedBaseUrl.includes('keycloak')) {
  baseUrlVariants.push(normalizedBaseUrl.replace('keycloak', 'localhost'));
} else if (normalizedBaseUrl.includes('localhost')) {
  baseUrlVariants.push(normalizedBaseUrl.replace('localhost', 'keycloak'));
}
const allowedIssuers = baseUrlVariants.map(url => `${url}/realms/${config.KEYCLOAK_REALM}`);

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

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const token = authHeader.slice(7).trim();

  try {
    // First verify without issuer check to get the payload
    const { payload } = await jwtVerify(token, remoteJwks, {
      audience: configuredAudiences.length > 0 ? configuredAudiences : undefined
    });

    // Then validate the issuer manually to allow both localhost and keycloak
    if (!allowedIssuers.includes(payload.iss)) {
      return res.status(401).json({ error: 'Invalid token issuer' });
    }

    if (!hasRequiredRole(payload)) {
      return res.status(403).json({ error: 'Insufficient role' });
    }

    req.user = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      roles: payload?.realm_access?.roles || [],
    };

    return next();
  } catch (error) {
    console.error('Authentication error', error);
    if (error.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}
