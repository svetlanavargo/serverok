# dndbackend API

Backend API for auth, games, and characters.

## Base URL

`http://localhost:3000`

## Headers

For JSON requests:

```http
Content-Type: application/json
```

For browser requests with auth:

- use `credentials: 'include'`
- session cookie `sid` will be sent automatically after login

## Response Format

Success:

```json
{
  "ok": true,
  "data": {}
}
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "GAME_NOT_FOUND",
    "message": "Game not found"
  }
}
```

## Auth

### `POST /api/register`

Body:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### `POST /api/login`

Body:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### `POST /api/logout`

No body required.

### `GET /api/me`

Returns current user from session.

## Games

Game object:

```json
{
  "id": "1d9d52c6-1144-4915-a754-37b9624f0533",
  "name": "123",
  "cards": [
    {
      "id": "w4ebumld0",
      "name": "123123123123",
      "ac": 10,
      "currentHits": 10,
      "maxHits": 10,
      "initiativeBonus": 0,
      "isPlayer": false,
      "note": "",
      "color": "red"
    }
  ],
  "turnTimeMode": "round"
}
```

### `POST /api/games`

Creates a game from the full frontend payload.

Body:

```json
{
  "id": "1d9d52c6-1144-4915-a754-37b9624f0533",
  "name": "123",
  "cards": [],
  "turnTimeMode": "round"
}
```

### `GET /api/games`

Returns all games for the current user.

### `POST /api/games/update`

Body must contain `id` and at least one field to update:

```json
{
  "id": "1d9d52c6-1144-4915-a754-37b9624f0533",
  "name": "New name",
  "cards": [],
  "turnTimeMode": "time"
}
```

### `POST /api/games/delete`

Body:

```json
{
  "id": "1d9d52c6-1144-4915-a754-37b9624f0533"
}
```

## Characters

### `POST /api/characters`

Creates a character. Requires at least:

```json
{
  "name": "Grom",
  "class": "barbarian"
}
```

### `GET /api/characters`

Returns all characters for the current user.

### `POST /api/characters/update`

Body:

```json
{
  "id": "character-id",
  "name": "Updated name"
}
```

### `POST /api/characters/delete`

Body:

```json
{
  "id": "character-id"
}
```

## Error Codes

Common codes:

- `UNAUTHORIZED`
- `MISSING_FIELDS`
- `MISSING_CREDENTIALS`
- `INVALID_CREDENTIALS`
- `INVALID_EMAIL`
- `PASSWORD_TOO_SHORT`
- `USER_ALREADY_EXISTS`
- `INVALID_GAME_PAYLOAD`
- `INVALID_CHARACTER_PAYLOAD`
- `INVALID_PAYLOAD`
- `MISSING_ID`
- `GAME_NOT_FOUND`
- `CHARACTER_NOT_FOUND`
