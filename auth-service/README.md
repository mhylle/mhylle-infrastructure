# Authentication Service

A centralized authentication and authorization service for the multi-application hosting platform. Provides cookie-based SSO across all applications without requiring shared libraries.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev

# Run tests
npm test

# Build for production
npm run build
```

## Architecture Overview

This authentication service uses a **cookie-based SSO approach** that eliminates the need for shared libraries while providing seamless single sign-on across all applications.

### Key Features

- ✅ **Zero Shared Dependencies** - No npm packages to manage across apps
- ✅ **Single Sign-On** - Login once, access all permitted applications
- ✅ **Multi-Tenant Roles** - Different roles per application per user
- ✅ **Secure by Default** - HTTP-only cookies, CSRF protection, rate limiting
- ✅ **Simple Integration** - ~50 lines of code per application
- ✅ **Technology Agnostic** - Works with any frontend framework

### How It Works

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   example-app1  │    │   example-app2  │    │   auth-service  │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Login UI    │ │    │ │ Login UI    │ │    │ │ Auth API    │ │
│ │ (~50 lines) │ │    │ │ (~50 lines) │ │    │ │ (Full Logic)│ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Domain Cookie   │
                    │ .mhylle.com     │
                    │ (SSO Token)     │
                    └─────────────────┘
```

## API Endpoints

### Public Endpoints
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - Invalidate session
- `GET /api/auth/health` - Service health check

### Protected Endpoints
- `GET /api/auth/validate` - Validate current session
- `GET /api/auth/me` - Get user profile
- `PUT /api/auth/me` - Update user profile
- `POST /api/auth/change-password` - Change password

### Admin Endpoints
- `GET /api/auth/users` - List users
- `POST /api/auth/users` - Create user
- `GET /api/auth/users/:id` - Get user details
- `PUT /api/auth/users/:id` - Update user
- `DELETE /api/auth/users/:id` - Deactivate user

See [API Documentation](docs/API.md) for complete reference.

## Database Schema

```sql
-- Core user table
users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  first_name VARCHAR,
  last_name VARCHAR,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Multi-tenant role assignments
user_app_roles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  app_id VARCHAR NOT NULL, -- 'app1', 'app2', etc.
  role VARCHAR NOT NULL,   -- 'admin', 'user', 'viewer'
  granted_at TIMESTAMP DEFAULT NOW(),
  granted_by UUID REFERENCES users(id),
  UNIQUE(user_id, app_id, role)
);
```

## Integration Examples

### Angular Application Integration

1. **Create Auth Service** (~30 lines):
```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  async validateSession(): Promise<UserInfo | null> {
    const response = await fetch('/api/auth/validate', {
      credentials: 'include'
    });
    return response.ok ? await response.json() : null;
  }

  async login(email: string, password: string): Promise<UserInfo> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) throw new Error('Login failed');
    return await response.json();
  }
}
```

2. **Add Auth Guard** (~15 lines):
```typescript
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  async canActivate(): Promise<boolean> {
    const user = await this.authService.validateSession();
    return user?.permissions.apps.includes('app1') || false;
  }
}
```

3. **Add Login Component** (~5 lines of logic):
```typescript
async onSubmit() {
  try {
    await this.authService.login(this.email, this.password);
    // User automatically logged in via cookie
  } catch (error) {
    this.errorMessage = error.message;
  }
}
```

See [Integration Guide](docs/INTEGRATION.md) for complete implementation details.

## Security Features

### Authentication Security
- **bcrypt** password hashing with 12+ salt rounds
- **JWT tokens** with RS256 asymmetric signing
- **Rate limiting** on login attempts (5/minute)
- **Account lockout** after failed attempts

### Cookie Security
```javascript
// Secure cookie configuration
response.cookie('auth_token', jwtToken, {
  domain: '.mhylle.com',     // Available to all subdomains
  path: '/',                 // Available to all paths
  httpOnly: true,           // Prevents XSS attacks
  secure: true,             // HTTPS only
  sameSite: 'strict',       // CSRF protection
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
});
```

### API Security
- **CORS** configured for mhylle.com domains only
- **CSRF protection** via SameSite cookies
- **Input validation** with class-validator
- **SQL injection prevention** via TypeORM

## Deployment

### Docker Configuration
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
```

### Environment Variables
```bash
# Database
DB_HOST=mhylle-postgres
DB_PORT=5432
DB_NAME=auth_db
DB_USER=auth_user
DB_PASSWORD=${AUTH_DB_PASSWORD}

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_TTL=60000
RATE_LIMIT_LIMIT=5

# CORS
CORS_ORIGIN=https://mhylle.com,https://*.mhylle.com
```

### GitHub Actions Deployment
The service deploys automatically via GitHub Actions when pushed to main branch:
1. **Build** - Creates Docker image
2. **Test** - Runs unit and integration tests  
3. **Deploy** - Pushes to container registry
4. **Update** - Pulls and restarts on server

See [.github/workflows/deploy.yml](.github/workflows/deploy.yml) for workflow details.

## Development

### Local Development
```bash
# Install dependencies
npm install

# Start PostgreSQL (via Docker Compose)
docker-compose up -d postgres

# Run database migrations
npm run migration:run

# Start development server
npm run start:dev

# Server runs at http://localhost:3000
# API available at http://localhost:3000/api/auth
```

### Database Commands
```bash
# Generate new migration
npm run migration:generate -- src/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Drop database schema
npm run schema:drop
```

### Testing
```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Project Structure

```
auth-service/
├── src/
│   ├── auth/               # Authentication module
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   ├── users/              # User management module
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.module.ts
│   │   ├── dto/
│   │   └── entities/
│   ├── entities/           # Database entities
│   │   ├── user.entity.ts
│   │   └── user-app-role.entity.ts
│   ├── migrations/         # Database migrations
│   ├── config/             # Configuration
│   ├── guards/             # Auth guards
│   ├── decorators/         # Custom decorators
│   └── main.ts             # Application entry point
├── docs/                   # Documentation
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── INTEGRATION.md
├── test/                   # E2E tests
├── Dockerfile              # Container configuration
├── docker-compose.yml      # Local development
└── .github/                # CI/CD workflows
```

## Documentation

- **[Architecture](docs/ARCHITECTURE.md)** - System design and components
- **[API Reference](docs/API.md)** - Complete endpoint documentation
- **[Integration Guide](docs/INTEGRATION.md)** - Step-by-step app integration

## Contributing

1. Create feature branch from `main`
2. Implement changes with tests
3. Update documentation if needed
4. Submit pull request with description
5. Automated tests run on PR
6. Merge after approval

## Support

For issues or questions:
1. Check the [Integration Guide](docs/INTEGRATION.md) for common solutions
2. Review API responses for error details
3. Check service logs for debugging information
4. Create issue with reproduction steps

## License

Private project - All rights reserved.

---

**Authentication Service** - Secure, scalable, cookie-based SSO for multi-application platforms.
