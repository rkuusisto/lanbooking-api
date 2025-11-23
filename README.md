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
| `KEYCLOAK_HOSTNAME` | Hostname for Keycloak (e.g. `auth.example.com`) | Required in production |
| `KEYCLOAK_HOSTNAME_STRICT` | Enforce strict hostname checking | `true` |
| `KEYCLOAK_HOSTNAME_STRICT_HTTPS` | Enforce HTTPS for strict hostname | `true` |
| `KEYCLOAK_HTTP_ENABLED` | Allow HTTP access (set to `true` when behind reverse proxy, `false` for direct HTTPS) | `true` (behind proxy) |
| `KEYCLOAK_HTTP_PORT` | HTTP port for Keycloak (internal) | `8080` |
| `KEYCLOAK_ADMIN` | Keycloak admin username | `admin` |
| `KEYCLOAK_ADMIN_PASSWORD` | Keycloak admin password | **Must be changed in production** |
| `KEYCLOAK_DB_USER` | Keycloak database username | `keycloak` |
| `KEYCLOAK_DB_PASSWORD` | Keycloak database password | **Must be changed in production** |
| `KEYCLOAK_DB_NAME` | Keycloak database name | `keycloak` |

**Important for production:**
- Keycloak runs in optimized production mode (`start --optimized`)
- Set `KEYCLOAK_HOSTNAME` to your production domain (what end users see)
- Ensure strong passwords for `KEYCLOAK_ADMIN_PASSWORD` and `KEYCLOAK_DB_PASSWORD`
- Set `KEYCLOAK_BASE_URL` in the API service to use HTTPS URL in production

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

To boot everything locally:

```bash
docker compose up --build
```

Update the `lanbooking-api` client secret inside `keycloak/lanbooking-realm.json` before importing, or override it directly in Keycloak after the first start. Assign the `intra-admin` role to any users who should access the protected endpoints.

## Frontend Handoff

The intra routes are documented for the frontend agent in [`docs/frontend-intra.md`](docs/frontend-intra.md). It covers:

- Keycloak login flow and required headers
- Registrations/Bookings/LAN-settings CRUD endpoints
- Billing flag semantics (`Lanbooking.done`)

## License

See [LICENSE](LICENSE).

