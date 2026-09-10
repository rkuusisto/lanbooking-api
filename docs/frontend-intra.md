# Intra Frontend Integration Guide

This document outlines how the new authenticated intra endpoints behave so the frontend agent can build the UI without digging into backend code.

## Authentication (Keycloak)

- Realm: `lanbooking`
- Resource server client (audience expected by backend): `lanbooking-api`
- Suggested public frontend client: `lanbooking-frontend` (PKCE enabled, standard OpenID Connect)
- Required role for calling intra APIs: `intra-admin` (realm role). Assign it to any user that should access the dashboard.
- Token type: Bearer access token (JWT). Include it in the `Authorization` header for every request.

Sample token request (Authorization Code + PKCE):

1. Generate code verifier/challenge locally.
2. Redirect to `https://<keycloak-host>/realms/lanbooking/protocol/openid-connect/auth?client_id=lanbooking-frontend&response_type=code&scope=openid%20profile%20email&code_challenge=<challenge>&code_challenge_method=S256&redirect_uri=<frontend-url>`.
3. Exchange the authorization code for tokens at `.../token` with the same verifier.

You only need the `access_token` for API calls. Refresh tokens are optional for silent renewals.

## Base URL & Headers

- Base path: `/api/v1/intra`
- Requests must include:

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

## Registrations API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/registrations` | List every registration (ordered by newest first). |
| GET | `/registrations/:id` | Fetch a single registration. |
| POST | `/registrations` | Create a registration manually. |
| PUT | `/registrations/:id` | Update a registration (any subset of fields). |
| DELETE | `/registrations/:id` | Remove a registration (hard delete). |

Body fields use camelCase. Required on `POST`: `firstname`, `lastname`, `email`. Bit columns (`devicePc`, `attendingThu`, tournament flags, dietary flags, etc.) expect booleans. `history` is an optional integer flag for archival workflows.

Sample payload:

```json
{
  "firstname": "Ada",
  "lastname": "Lovelace",
  "email": "ada@example.com",
  "devicePc": true,
  "attendingThu": true,
  "tournamentLOL": false,
  "history": 0,
  "feedback": "Needs power on table 12"
}
```

Responses:
- `data` is an object with the same camelCase keys plus `id` (string) and all stored values. Bit fields are returned as booleans.

## Bookings API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/bookings` | List bookings. |
| GET | `/bookings/:id` | Fetch a single booking. |
| POST | `/bookings` | Create a booking (requires `email` + `code`). |
| PUT | `/bookings/:id` | Update email/code/location/invitation/done fields. |
| POST | `/bookings/:id/swap` | Swap the booking onto an occupied seat. Body: `{ "location": "B7" }`. |
| PATCH | `/bookings/:id/billing` | Convenience endpoint to toggle the billing `done` flag. |
| DELETE | `/bookings/:id` | Remove a booking record. |

Billing status:
- The `done` column mirrors the DDL (`int`). Treat `0` as pending and `1` as paid/handled. The PATCH endpoint expects `{ "done": 1 }` or `{ "done": 0 }` (booleans also work).
- `invitationSent` is a boolean bit. Defaults to `false` on creation.
- `PUT /bookings/:id` may set `location` to any free seat, including seats listed in `BlockedLocations`. Assigning a seat already held by another booking returns `409 Location already booked`. Clearing a seat uses `location: null`.
- `POST /bookings/:id/swap` moves the source booking onto an occupied seat. The previous occupant receives the source booking's old seat, or is cleared if the source had no seat. Returns `{ "source": <booking>, "target": <booking or null> }`.

## Blocked Locations API

Blocked seats cannot be claimed via the public booking API (`POST /api/v1/lanbooking`). Intra can still assign those seats manually.

Requires the `[BlockedLocations]` table. Run [`database/create-blocked-locations-table.sql`](../database/create-blocked-locations-table.sql) against Azure SQL before using these endpoints.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/blocked-locations` | List blocked seat IDs (ordered by location). |
| POST | `/blocked-locations` | Block a seat. Body: `{ "location": "A1" }`. |
| DELETE | `/blocked-locations/:location` | Unblock a seat. |

The public booking map also exposes `GET /api/v1/lanbooking/blocked` (no auth) as a string array of location IDs.

Sample blocked location object:

```json
{
  "id": "1",
  "location": "A1",
  "createdAt": "2026-09-10T12:00:00.000Z"
}
```

`POST` returns `409` if the seat is already blocked. `DELETE` returns `404` if it is not blocked.

## LAN Settings API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/settings` | List all historical settings entries. |
| GET | `/settings/current` | Fetch the latest settings row (ordered by `id`). |
| GET | `/settings/:id` | Fetch a single settings entry. |
| POST | `/settings` | Create a new entry (required: `total`, `startDate`, `endDate`, `eventName`). |
| PUT | `/settings/:id` | Update an existing entry (any subset of fields). |
| DELETE | `/settings/:id` | Remove an entry. |

Notes:
- Dates must be ISO-8601 (`YYYY-MM-DD`).
- API returns `startDate`/`endDate` in the same format plus `createdAt`/`updatedAt` as ISO timestamps.

## Common Response Format

All successful calls return:

```json
{ "data": <object or array> }
```

Errors use:

```json
{ "error": "<reason>" }
```

## Key Field Reference

### Registrations
| Field | Type | Notes |
| --- | --- | --- |
| firstname / lastname | string | Required. |
| phone / parentPhone | string | Optional contact info. |
| devicePc / deviceConsole / deviceHanging / deviceOther | boolean | Bring-your-own device flags. |
| attendingThu / attendingFri | boolean | Attendance days. |
| tournament* | boolean or string | Each bit column mirrors the DDL, `tournamentOtherComment` is free text. |
| food | boolean | `true` if meals ordered. |
| diet, dietL, dietG, dietV, dietOther | booleans | Represent each dietary option. |
| history | integer | Optional archival marker (match legacy semantics). |
| steamId, nickname, feedback | string | Optional metadata. |

### Bookings
| Field | Type | Notes |
| --- | --- | --- |
| email | string | Required, unique per registration. |
| code | string | Required booking code. |
| location | string | Seat/table info. Intra may assign blocked seats; public booking may not. |
| invitationSent | boolean | Whether the invitation email has been sent. |
| done | integer | Billing status flag (0/1). |

### LAN Settings
| Field | Type | Notes |
| --- | --- | --- |
| total | integer | Total seats. |
| startDate / endDate | date string | ISO dates. |
| eventName | string | Public-facing event label. |
| createdAt / updatedAt | ISO timestamp | Read-only metadata. |

## Example Fetch Call

```js
async function fetchRegistrations(token) {
  const res = await fetch('/api/v1/intra/registrations', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  const payload = await res.json();
  return payload.data;
}
```

Keep the token fresh (renew before expiry) and reuse the same logic for bookings and settings.
