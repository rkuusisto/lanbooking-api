# lanbooking-api

| Language | Framework | Platform | Author |
| -------- | -------- | -------- | ------ |
| Node.js  | Express   | Azure Web App / VM | |

Node.js Express REST API for LAN bookings with SendGrid notifications and Azure SQL storage. This repo now also exposes an authenticated **intra** surface for registrations, bookings, billing, and LAN settings. Frontend instructions live in `docs/frontend-intra.md`.

## Configuration

Set the following environment variables before starting the API (e.g. via `.env` or the container runtime):

> **Production Setup:** See [`env.production.example`](env.production.example) for a complete production environment template. Copy it to `.env` on your production server and fill in all values.

| Variable | Description |
| --- | --- |
| `DB_HOST` | Database host name |
| `DB_NAME` | Database name |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database user password |
| `SENDGRID_API_KEY` | SendGrid API Key |
| `SG_BOOKING_TEMPLATE_ID` | SendGrid booking template ID |
| `SG_INVITE_TEMPLATE_ID` | SendGrid invite template ID |
| `INVITE_SECRET` | Legacy invite endpoint guard |
| `KEYCLOAK_BASE_URL` | Base URL of the Keycloak server (e.g. `http://localhost:8080`) |
| `KEYCLOAK_REALM` | Realm name (default `lanbooking`) |
| `KEYCLOAK_CLIENT_ID` | Client ID used as resource identifier (default `lanbooking-api`) |
| `KEYCLOAK_AUDIENCE` | Optional expected `aud` claim (comma separated) |
| `KEYCLOAK_REQUIRED_ROLE` | Realm/client role required to call intra endpoints (`intra-admin` recommended) |

The API fails fast if the Keycloak variables are missing, ensuring intra routes always remain protected.

### Keycloak Production Configuration

For production deployments, configure the following additional environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| `KEYCLOAK_MODE` | Keycloak mode: `"dev"` for development, `"production"` for production | `production` |
| `KEYCLOAK_HOSTNAME` | Hostname for Keycloak (e.g. `auth.example.com`) | Required in production |
| `KEYCLOAK_HOSTNAME_STRICT` | Enforce strict hostname checking | `true` (dev mode: `false`) |
| `KEYCLOAK_HOSTNAME_STRICT_HTTPS` | Enforce HTTPS for strict hostname | `true` (dev mode: `false`) |
| `KEYCLOAK_HTTP_ENABLED` | Allow HTTP access (set to `true` when behind reverse proxy, `false` for direct HTTPS) | `true` (behind proxy) |
| `KEYCLOAK_HTTP_PORT` | HTTP port for Keycloak (internal) | `8080` |
| `KEYCLOAK_ADMIN` | Keycloak admin username | `admin` |
| `KEYCLOAK_ADMIN_PASSWORD` | Keycloak admin password | **Must be changed in production** |
| `KEYCLOAK_DB_USER` | Keycloak database username | `keycloak` |
| `KEYCLOAK_DB_PASSWORD` | Keycloak database password | **Must be changed in production** |
| `KEYCLOAK_DB_NAME` | Keycloak database name | `keycloak` |

**Development vs Production Mode:**
- **Dev mode** (`KEYCLOAK_MODE=dev`): Uses `start-dev`, enables HTTP, disables strict hostname checking, no optimization build
- **Production mode** (`KEYCLOAK_MODE=production`): Uses `start --optimized`, respects all security settings, optimized build for performance

**Important for production:**
- Set `KEYCLOAK_MODE=production` (or leave unset, as production is the default)
- Keycloak runs in optimized production mode (`start --optimized`)
- Set `KEYCLOAK_HOSTNAME` to your production domain (what end users see)
- Ensure strong passwords for `KEYCLOAK_ADMIN_PASSWORD` and `KEYCLOAK_DB_PASSWORD`
- Set `KEYCLOAK_BASE_URL` in the API service to use HTTPS URL in production

**For local development:**
- Set `KEYCLOAK_MODE=dev` in your local `.env` file for faster startup and relaxed security settings

**Reverse Proxy Configuration:**
- When running behind a reverse proxy (nginx, Traefik, etc.), set `KEYCLOAK_HTTP_ENABLED=true`
- The reverse proxy handles HTTPS termination and forwards HTTP to Keycloak internally
- Ensure your reverse proxy forwards proper headers (X-Forwarded-For, X-Forwarded-Proto, X-Forwarded-Host)
- `KC_PROXY=edge` tells Keycloak to trust proxy headers
- No HTTPS port configuration needed when behind a reverse proxy

## Local Keycloak Stack

`docker-compose.yml` now provisions:

- `lanbooking-api` – the Node backend
- `keycloak` – Keycloak 24 (importing `keycloak/lanbooking-realm.json`)
- `keycloak-db` – Postgres backing store

### Docker Network Setup

The API connects to an external Docker network (`lanbooking-network`) to allow inter-service communication with other services like the CS2 demo uploader. Before starting the services for the first time, create the network:

```bash
# Create the shared network (run once)
docker network create lanbooking-network
```

Then boot everything locally:

```bash
# Default: runs in production mode
docker compose up --build

# Or set KEYCLOAK_MODE=dev in your .env file for development mode
```

**Network Configuration:**
- **Internal network (default)**: Used for communication between api, keycloak, and keycloak-db
- **External network (lanbooking-network)**: Allows external services to communicate with the API
- Other services (e.g., `cs2-demo-uploader`) can join this network to access the lanbooking-api endpoints

Update the `lanbooking-api` client secret inside `keycloak/lanbooking-realm.json` before importing, or override it directly in Keycloak after the first start. Assign the `intra-admin` role to any users who should access the protected endpoints.

## Frontend Handoff

The intra routes are documented for the frontend agent in [`docs/frontend-intra.md`](docs/frontend-intra.md). It covers:

- Keycloak login flow and required headers
- Registrations/Bookings/LAN-settings CRUD endpoints
- Billing flag semantics (`Lanbooking.done`)

## License

See [LICENSE](LICENSE).

