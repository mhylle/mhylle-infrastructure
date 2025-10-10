# API Specification

**Feature**: Notes CRUD, Conversations, and Categorization
**Version**: 1.0.0
**Base URL**: `/api`
**Authentication**: Required (JWT Bearer token in Authorization header)

## REST API Endpoints

### Notes API (Extended)

#### Update Note
```
PUT /notes/:id
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "title": "string (1-200 chars, optional)",
  "content": "string (optional)"
}

Response 200:
{
  "id": "uuid",
  "title": "string",
  "content": "string",
  "userId": "uuid",
  "conversationId": "uuid | null",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "categories": [
    { "id": "uuid", "name": "string", "type": "system" | "user" }
  ]
}

Errors:
- 400: Validation error
- 401: Unauthorized
- 403: Forbidden (not owner)
- 404: Note not found
```

#### Delete Note
```
DELETE /notes/:id
Authorization: Bearer {token}

Response 204: No Content

Errors:
- 401: Unauthorized
- 403: Forbidden (not owner)
- 404: Note not found

Side Effects:
- Note removed from conversation (if applicable)
- Category associations removed
```

#### Update Note Categories
```
PUT /notes/:id/categories
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "categoryIds": ["uuid", "uuid", ...]
}

Response 200:
{
  "id": "uuid",
  "categories": [
    { "id": "uuid", "name": "string", "type": "system" | "user" }
  ]
}

Errors:
- 400: Invalid category IDs or categories not available to user
- 401: Unauthorized
- 403: Forbidden (not owner)
- 404: Note not found
```

#### Assign Note to Conversation
```
PATCH /notes/:id/conversation
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "conversationId": "uuid | null"  // null removes from conversation
}

Response 200:
{
  "id": "uuid",
  "conversationId": "uuid | null",
  "updatedAt": "ISO8601"
}

Errors:
- 400: Invalid conversation ID
- 401: Unauthorized
- 403: Forbidden (not owner of note or conversation)
- 404: Note or conversation not found

Side Effects:
- If note already in different conversation, moves to new one
```

---

### Conversations API (New)

#### Create Conversation
```
POST /conversations
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "title": "string (1-200 chars, required)",
  "description": "string (optional, max 2000 chars)"
}

Response 201:
{
  "id": "uuid",
  "title": "string",
  "description": "string | null",
  "userId": "uuid",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "noteCount": 0
}

Errors:
- 400: Validation error
- 401: Unauthorized
```

#### List User's Conversations
```
GET /conversations
Authorization: Bearer {token}

Query Parameters:
- limit: number (default: 50, max: 100)
- offset: number (default: 0)
- sortBy: "createdAt" | "updatedAt" | "title" (default: "updatedAt")
- order: "ASC" | "DESC" (default: "DESC")

Response 200:
{
  "conversations": [
    {
      "id": "uuid",
      "title": "string",
      "description": "string | null",
      "noteCount": number,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "total": number,
  "limit": number,
  "offset": number
}

Errors:
- 401: Unauthorized
```

#### Get Conversation with Notes
```
GET /conversations/:id
Authorization: Bearer {token}

Query Parameters:
- includeNotes: boolean (default: true)

Response 200:
{
  "id": "uuid",
  "title": "string",
  "description": "string | null",
  "userId": "uuid",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "categories": [
    { "id": "uuid", "name": "string", "type": "system" | "user" }
  ],
  "notes": [
    {
      "id": "uuid",
      "title": "string",
      "content": "string",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601",
      "categories": [...]
    }
  ]
}

Errors:
- 401: Unauthorized
- 403: Forbidden (not owner)
- 404: Conversation not found

Notes:
- Notes are ordered chronologically (createdAt ASC)
```

#### Update Conversation
```
PUT /conversations/:id
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "title": "string (1-200 chars, optional)",
  "description": "string (optional, max 2000 chars)"
}

Response 200:
{
  "id": "uuid",
  "title": "string",
  "description": "string | null",
  "updatedAt": "ISO8601"
}

Errors:
- 400: Validation error
- 401: Unauthorized
- 403: Forbidden (not owner)
- 404: Conversation not found
```

#### Delete Conversation
```
DELETE /conversations/:id
Authorization: Bearer {token}

Response 204: No Content

Errors:
- 401: Unauthorized
- 403: Forbidden (not owner)
- 404: Conversation not found

Side Effects:
- All notes in conversation become standalone (conversationId set to NULL)
- Category associations for conversation removed
```

#### Create Note in Conversation
```
POST /conversations/:id/notes
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "title": "string (1-200 chars, required)",
  "content": "string (required)"
}

Response 201:
{
  "id": "uuid",
  "title": "string",
  "content": "string",
  "conversationId": "uuid",
  "userId": "uuid",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "categories": []
}

Errors:
- 400: Validation error
- 401: Unauthorized
- 403: Forbidden (not owner of conversation)
- 404: Conversation not found
```

#### Update Conversation Categories
```
PUT /conversations/:id/categories
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "categoryIds": ["uuid", "uuid", ...]
}

Response 200:
{
  "id": "uuid",
  "categories": [
    { "id": "uuid", "name": "string", "type": "system" | "user" }
  ]
}

Errors:
- 400: Invalid category IDs or categories not available to user
- 401: Unauthorized
- 403: Forbidden (not owner)
- 404: Conversation not found
```

---

### Categories API (New)

#### List Available Categories
```
GET /categories
Authorization: Bearer {token}

Query Parameters:
- type: "system" | "user" | "all" (default: "all")

Response 200:
{
  "categories": [
    {
      "id": "uuid",
      "name": "string",
      "type": "system" | "user",
      "createdAt": "ISO8601"
    }
  ]
}

Notes:
- Returns system categories + user's custom categories
- System categories cannot be modified or deleted

Errors:
- 401: Unauthorized
```

#### Create Custom Category
```
POST /categories
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "name": "string (1-100 chars, required)"
}

Response 201:
{
  "id": "uuid",
  "name": "string",
  "type": "user",
  "userId": "uuid",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}

Errors:
- 400: Validation error or duplicate name
- 401: Unauthorized
```

#### Update Custom Category
```
PUT /categories/:id
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "name": "string (1-100 chars, required)"
}

Response 200:
{
  "id": "uuid",
  "name": "string",
  "updatedAt": "ISO8601"
}

Errors:
- 400: Validation error or duplicate name
- 401: Unauthorized
- 403: Forbidden (cannot modify system categories or other user's categories)
- 404: Category not found
```

#### Delete Custom Category
```
DELETE /categories/:id
Authorization: Bearer {token}

Response 204: No Content

Errors:
- 401: Unauthorized
- 403: Forbidden (cannot delete system categories or other user's categories)
- 404: Category not found

Side Effects:
- Removes category associations from all notes and conversations
- Notes and conversations are preserved
```

#### Get Notes by Category
```
GET /categories/:id/notes
Authorization: Bearer {token}

Query Parameters:
- limit: number (default: 50, max: 100)
- offset: number (default: 0)

Response 200:
{
  "notes": [
    {
      "id": "uuid",
      "title": "string",
      "content": "string",
      "createdAt": "ISO8601",
      "categories": [...]
    }
  ],
  "total": number,
  "limit": number,
  "offset": number
}

Errors:
- 401: Unauthorized
- 403: Forbidden (category not available to user)
- 404: Category not found
```

#### Get Conversations by Category
```
GET /categories/:id/conversations
Authorization: Bearer {token}

Query Parameters:
- limit: number (default: 50, max: 100)
- offset: number (default: 0)

Response 200:
{
  "conversations": [
    {
      "id": "uuid",
      "title": "string",
      "description": "string | null",
      "noteCount": number,
      "createdAt": "ISO8601",
      "categories": [...]
    }
  ],
  "total": number,
  "limit": number,
  "offset": number
}

Errors:
- 401: Unauthorized
- 403: Forbidden (category not available to user)
- 404: Category not found
```

---

## DTO Specifications

### CreateConversationDto
```typescript
{
  title: string;        // required, 1-200 chars
  description?: string; // optional, max 2000 chars
}
```

### UpdateConversationDto
```typescript
{
  title?: string;       // optional, 1-200 chars
  description?: string; // optional, max 2000 chars
}
```

### CreateCategoryDto
```typescript
{
  name: string;         // required, 1-100 chars
}
```

### UpdateCategoryDto
```typescript
{
  name: string;         // required, 1-100 chars
}
```

### UpdateNoteDto
```typescript
{
  title?: string;       // optional, 1-200 chars
  content?: string;     // optional
}
```

### AssignCategoriesDto
```typescript
{
  categoryIds: string[]; // required, array of UUIDs
}
```

### AssignConversationDto
```typescript
{
  conversationId: string | null; // UUID or null to remove
}
```

---

## Error Response Format

All errors follow consistent structure:
```json
{
  "statusCode": number,
  "message": string | string[],
  "error": string,
  "timestamp": "ISO8601"
}
```

**Common Status Codes**:
- 200: Success
- 201: Created
- 204: No Content (successful deletion)
- 400: Bad Request (validation error)
- 401: Unauthorized (missing/invalid token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 500: Internal Server Error

---

## Authentication

All endpoints require JWT Bearer token:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Token contains:
- `userId`: UUID of authenticated user
- `email`: User's email address
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp

**Token Validation**:
- Verified on every request
- User must own resources they access (notes, conversations, user categories)
- System categories are read-only for all users

---

## Rate Limiting

- 100 requests per minute per user
- Exceeding limit returns 429 Too Many Requests
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`: Requests allowed per minute
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Timestamp when limit resets

---

## Pagination

List endpoints support pagination:
- `limit`: Max items to return (default: 50, max: 100)
- `offset`: Number of items to skip (default: 0)

Responses include:
- `total`: Total count of items
- `limit`: Applied limit
- `offset`: Applied offset

**Example**:
```
GET /conversations?limit=20&offset=40
```

---

**Status**: ✅ Complete - Ready for E2E test generation
