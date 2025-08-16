# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the authentication service.

## Service Overview

This is the **Authentication Service** - a centralized auth system providing cookie-based SSO for all applications in the mhylle.com platform. It uses JWT tokens stored in secure HTTP-only cookies to eliminate the need for shared libraries.

## Architecture Principles

- **No Shared Libraries** - Each app integrates with ~50 lines of code
- **Cookie-Based SSO** - Domain-wide cookies provide seamless authentication
- **Multi-Tenant Roles** - Users can have different roles per application
- **Stateless Design** - JWT tokens contain all necessary information

## Common Development Commands

```bash
# Development
npm run start:dev         # Start with hot-reload
npm run build            # Build for production
npm test                 # Run unit tests
npm run test:e2e         # Run E2E tests

# Database
npm run migration:generate -- AddUserTable  # Generate migration
npm run migration:run                       # Run migrations
npm run migration:revert                    # Revert last migration

# Docker
docker-compose up -d     # Start all services
docker-compose logs -f   # View logs
docker-compose down      # Stop services
```

## Key Implementation Details

### Cookie Configuration
The service sets secure cookies with:
- `domain: '.mhylle.com'` - Available to all subdomains
- `httpOnly: true` - Prevents XSS attacks
- `secure: true` - HTTPS only in production
- `sameSite: 'strict'` - CSRF protection

### JWT Token Structure
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "apps": ["app1", "app2"],
  "roles": {
    "app1": ["admin"],
    "app2": ["user"]
  },
  "iat": 1640908800,
  "exp": 1640995200
}
```

### Database Schema
- `users` - Core user information
- `user_app_roles` - Multi-tenant role assignments
- `auth_events` - Audit logging
- `refresh_tokens` - Optional refresh token support

## Security Considerations

### Password Security
- bcrypt with 12+ salt rounds
- Complexity requirements enforced
- Rate limiting on login attempts

### API Security
- CORS configured for mhylle.com domains
- Rate limiting per endpoint
- Input validation with class-validator
- SQL injection prevention via TypeORM

## Testing Strategy

### Unit Tests
```bash
npm test                    # Run all unit tests
npm run test:watch         # Watch mode
npm run test:cov          # Coverage report
```

### E2E Tests
```bash
npm run test:e2e           # Run E2E tests
```

### Manual Testing
```bash
# Test login
curl -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mhylle.com","password":"Admin123!"}'

# Test validation (include cookies)
curl http://localhost:3003/api/auth/validate \
  -H "Cookie: auth_token=<jwt-token>"

# Health check
curl http://localhost:3003/api/auth/health
```

## Deployment Process

### Local Development
1. Copy `.env.example` to `.env`
2. Run `docker-compose up -d`
3. Service available at `http://localhost:3003`

### Production Deployment
- Automatic via GitHub Actions on push to main
- Docker image pushed to GitHub Container Registry
- Deployed to mhylle.com infrastructure
- Available at `https://mhylle.com/api/auth/*`

## Common Issues & Solutions

### Database Connection Failed
- Check PostgreSQL is running: `docker ps`
- Verify credentials in `.env`
- Ensure database exists: `auth_db`

### Cookies Not Working
- Verify domain setting matches deployment
- Check CORS configuration includes app domains
- Ensure HTTPS in production

### Rate Limiting Issues
- Login: 5 attempts per minute
- API: 30 requests per minute
- Adjust in environment variables if needed

## Integration Guide

Apps integrate with minimal code:

```typescript
// 1. Check for existing session
const response = await fetch('/api/auth/validate', {
  credentials: 'include'
});

// 2. Login if needed
const response = await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

// 3. Check app access
if (user.permissions.apps.includes('app1')) {
  // User has access
}
```

## File Structure

```
auth-service/
├── src/
│   ├── auth/           # Authentication logic
│   ├── users/          # User management
│   ├── entities/       # Database entities
│   ├── config/         # Configuration
│   └── main.ts         # Application entry
├── docs/               # Documentation
├── scripts/            # Database scripts
├── nginx/              # Nginx config (dev)
└── docker-compose.yml  # Local development
```

## Important Notes

- **Never commit .env files** - Use GitHub Secrets
- **Always hash passwords** - Never store plain text
- **Test migrations locally** - Before deploying
- **Monitor rate limits** - Adjust as needed
- **Keep cookies secure** - HTTP-only, Secure, SameSite

## Additional Resources

- [Architecture Documentation](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Integration Guide](docs/INTEGRATION.md)