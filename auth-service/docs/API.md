# Authentication Service API Reference

## Base URL
All API endpoints are served under `/api/auth/`

## Authentication
Most endpoints require a valid JWT token passed via HTTP-only cookie or Authorization header.

## Response Format
All responses follow a consistent JSON structure:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Public Endpoints

### POST /api/auth/login
Authenticate user with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "isActive": true
    },
    "permissions": {
      "apps": ["app1", "app2"],
      "roles": {
        "app1": ["admin"],
        "app2": ["user"]
      }
    }
  },
  "message": "Login successful"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

**Side Effects:**
- Sets secure HTTP-only cookie with JWT token
- Logs authentication event

**Rate Limiting:** 5 attempts per minute per IP

---

### POST /api/auth/logout
Invalidate current session.

**Request:** No body required

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Side Effects:**
- Clears authentication cookie
- Logs logout event

---

### GET /api/auth/health
Service health check endpoint.

**Request:** No authentication required

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": 3600,
    "database": "connected"
  }
}
```

## Protected Endpoints

### GET /api/auth/validate
Validate current authentication status and get user info.

**Headers:**
- Cookie: `auth_token=<jwt-token>` (automatically sent by browser)

**Response (Valid Token):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "permissions": {
      "apps": ["app1", "app2"],
      "roles": {
        "app1": ["admin"],
        "app2": ["user"]
      }
    },
    "tokenInfo": {
      "issuedAt": "2024-01-01T00:00:00Z",
      "expiresAt": "2024-01-02T00:00:00Z"
    }
  }
}
```

**Response (Invalid Token):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Authentication token is invalid or expired"
  }
}
```

---

### GET /api/auth/me
Get current user profile information.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "lastLoginAt": "2024-01-01T12:00:00Z"
  }
}
```

---

### PUT /api/auth/me
Update current user profile.

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "updatedAt": "2024-01-01T12:00:00Z"
  }
}
```

---

### POST /api/auth/change-password
Change user password.

**Request:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword456",
  "confirmPassword": "newpassword456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Validation Rules:**
- Current password must be correct
- New password must be at least 8 characters
- Must contain uppercase, lowercase, number, and special character
- Cannot be same as current password

## Admin Endpoints

Require admin role in at least one application.

### GET /api/auth/users
List all users with pagination.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 10, max: 100)
- `search` (optional: search by email or name)
- `appId` (optional: filter by app access)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid-string",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00Z",
        "lastLoginAt": "2024-01-01T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
}
```

---

### POST /api/auth/users
Create new user account.

**Request:**
```json
{
  "email": "newuser@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "password": "temppassword123",
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "email": "newuser@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### GET /api/auth/users/:id
Get specific user details.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z"
    },
    "permissions": {
      "apps": ["app1", "app2"],
      "roles": {
        "app1": ["admin"],
        "app2": ["user"]
      }
    }
  }
}
```

---

### PUT /api/auth/users/:id
Update user information.

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isActive": true,
    "updatedAt": "2024-01-01T12:00:00Z"
  }
}
```

---

### DELETE /api/auth/users/:id
Deactivate user account.

**Response:**
```json
{
  "success": true,
  "message": "User deactivated successfully"
}
```

**Note:** Users are soft-deleted (marked inactive) rather than permanently removed.

## Access Control Endpoints

### GET /api/auth/users/:id/apps
Get user's application access.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid-string",
    "apps": [
      {
        "appId": "app1",
        "roles": ["admin"],
        "grantedAt": "2024-01-01T00:00:00Z",
        "grantedBy": "admin-user-uuid"
      },
      {
        "appId": "app2", 
        "roles": ["user"],
        "grantedAt": "2024-01-01T00:00:00Z",
        "grantedBy": "admin-user-uuid"
      }
    ]
  }
}
```

---

### POST /api/auth/users/:id/apps/:appId/roles/:role
Grant role to user for specific application.

**Response:**
```json
{
  "success": true,
  "message": "Role granted successfully",
  "data": {
    "userId": "uuid-string",
    "appId": "app1",
    "role": "admin",
    "grantedAt": "2024-01-01T12:00:00Z",
    "grantedBy": "admin-user-uuid"
  }
}
```

---

### DELETE /api/auth/users/:id/apps/:appId/roles/:role
Revoke role from user for specific application.

**Response:**
```json
{
  "success": true,
  "message": "Role revoked successfully"
}
```

---

### GET /api/auth/apps/:appId/users
Get all users with access to specific application.

**Query Parameters:**
- `role` (optional: filter by specific role)

**Response:**
```json
{
  "success": true,
  "data": {
    "appId": "app1",
    "users": [
      {
        "user": {
          "id": "uuid-string",
          "email": "user@example.com",
          "firstName": "John",
          "lastName": "Doe"
        },
        "roles": ["admin"],
        "grantedAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

## Authentication Events

### GET /api/auth/events
Get authentication audit log.

**Query Parameters:**
- `userId` (optional)
- `appId` (optional)
- `eventType` (optional: login, logout, role_change)
- `from` (optional: ISO date)
- `to` (optional: ISO date)
- `page` (default: 1)
- `limit` (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "uuid-string",
        "userId": "uuid-string",
        "userEmail": "user@example.com",
        "eventType": "login",
        "appId": "app1",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "createdAt": "2024-01-01T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "pages": 3
    }
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_CREDENTIALS` | Email or password is incorrect |
| `INVALID_TOKEN` | JWT token is invalid or expired |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions |
| `USER_NOT_FOUND` | User ID does not exist |
| `USER_INACTIVE` | User account is deactivated |
| `EMAIL_ALREADY_EXISTS` | Email address is already registered |
| `VALIDATION_ERROR` | Request data validation failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests in time window |
| `INTERNAL_ERROR` | Server error occurred |

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `/api/auth/login` | 5 attempts per minute per IP |
| `/api/auth/validate` | 60 requests per minute per user |
| `/api/auth/users` (admin) | 100 requests per minute per user |
| All other endpoints | 30 requests per minute per user |

## Security Headers

All responses include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

## CORS Configuration

The auth service is configured to accept requests from:
- `https://mhylle.com`
- `https://*.mhylle.com` (subdomains)
- `http://localhost:*` (development only)

Credentials (cookies) are included in all CORS requests.