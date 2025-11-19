# lanbooking-api

| Language | Framework | Platform | Author |
| -------- | -------- | -------- | ------ |
| Node.js  | Express   | Azure Web App / VM | |

Node.js Express REST API for LAN bookings with SendGrid notifications and Azure SQL storage. This repo now also exposes an authenticated **intra** surface for registrations, bookings, billing, and LAN settings. Frontend instructions live in `docs/frontend-intra.md`.

## Configuration

Set the following environment variables before starting the API (e.g. via `.env` or the container runtime):

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

