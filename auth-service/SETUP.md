# Authentication Service Setup Guide

## 🏗️ Multi-Repository Architecture

This authentication service is part of the **infrastructure repository** and is deployed alongside shared services. The setup supports two configuration methods:

1. **Local .env file** (recommended for single-server deployments)
2. **GitHub Secrets** (recommended for multiple servers/environments)

## 🚀 Quick Setup

### Option 1: Local .env Configuration (Recommended)

```bash
# Navigate to infrastructure repository
cd /path/to/mhylle-infrastructure

# Copy environment template (if not already done)
cp .env.example .env

# Edit with your secure values
nano .env
```

Add these variables to the infrastructure `.env` file:

```bash
# Authentication Service Database
AUTH_DB_PASSWORD=your_secure_database_password_here

# JWT Secret (generate with: openssl rand -base64 64)
JWT_SECRET=your_jwt_secret_minimum_64_characters_long_random_string
```

### Option 2: GitHub Secrets Configuration

For multiple servers or enhanced security, use GitHub repository secrets:

1. Go to `Settings` → `Secrets and variables` → `Actions`
2. Add repository secrets:
   - `AUTH_DB_PASSWORD`: Your secure database password
   - `JWT_SECRET`: Your JWT signing secret (64+ characters)

### 3. Generate Secure Secrets

```bash
# Generate a secure database password
openssl rand -base64 32

# Generate a secure JWT secret
openssl rand -base64 64
```

### 4. Set File Permissions

```bash
chmod 600 .env
chown mhylle:mhylle .env
```

### 5. Deploy

The auth service will automatically deploy when you push to the main branch:

```bash
git add .env.example auth-service/SETUP.md
git commit -m "Add auth service setup documentation"
git push origin main
```

## 🔧 Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AUTH_DB_PASSWORD` | Database password for auth_user | `secure_random_password_123` |
| `JWT_SECRET` | Secret key for JWT token signing | `base64_encoded_secret_64_chars_min` |

### Auto-Configured Variables

These are automatically set by the deployment and don't need configuration:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Runtime environment |
| `DB_HOST` | `mhylle-postgres` | Database hostname |
| `DB_PORT` | `5432` | Database port |
| `DB_NAME` | `auth_db` | Database name |
| `DB_USER` | `auth_user` | Database username |
| `JWT_EXPIRES_IN` | `24h` | JWT token expiration |
| `BCRYPT_ROUNDS` | `12` | Password hashing rounds |
| `CORS_ORIGIN` | `https://mhylle.com,https://*.mhylle.com` | Allowed origins |
| `COOKIE_DOMAIN` | `.mhylle.com` | Cookie domain for SSO |
| `COOKIE_SECURE` | `true` | HTTPS-only cookies |
| `COOKIE_SAME_SITE` | `strict` | CSRF protection |

## 🏗️ Infrastructure Integration

### Database Setup

The auth database (`auth_db`) is automatically created when PostgreSQL starts for the first time. The initialization script:

1. Creates `auth_db` database
2. Creates `auth_user` with configured password
3. Sets up required tables and indexes
4. Creates default admin user

### Service Discovery

The auth service runs on:
- **Container**: `mhylle-auth-service`
- **Port**: `3003` (external) → `3000` (internal)
- **Network**: `mhylle_app-network`
- **Health Check**: `/health` endpoint

### API Endpoints

Once deployed, the service provides:
- **Health Check**: `https://mhylle.com/api/auth/health`
- **API Documentation**: See [API.md](docs/API.md)
- **Integration Guide**: See [INTEGRATION.md](docs/INTEGRATION.md)

## 🔐 Security Best Practices

### Environment File Security

```bash
# Set restrictive permissions
chmod 600 .env

# Verify ownership
ls -la .env
# Should show: -rw------- 1 mhylle mhylle

# Never commit to version control
echo ".env" >> .gitignore
```

### Password Generation

```bash
# Database password (32 characters)
openssl rand -base64 32

# JWT secret (64+ characters recommended)
openssl rand -base64 64

# Alternative using /dev/urandom
tr -dc A-Za-z0-9 </dev/urandom | head -c 64; echo
```

### JWT Secret Requirements

- **Minimum**: 64 characters
- **Recommended**: 128+ characters
- **Encoding**: Base64 or random alphanumeric
- **Uniqueness**: Different from other application secrets

## 🔍 Troubleshooting

### Deployment Fails with Environment Error

```bash
❌ ERROR: Missing required environment variables
AUTH_DB_PASSWORD: 
JWT_SECRET: 
```

**Solution**: Ensure `.env` file exists and contains required variables.

### Database Connection Failed

```bash
❌ ERROR: Auth service cannot connect to database
```

**Solutions**:
1. Verify PostgreSQL is running: `docker ps | grep postgres`
2. Check if auth_db exists: `docker exec mhylle-postgres psql -U postgres -l`
3. Verify auth_user password matches .env file

### JWT Secret Too Short

```bash
❌ ERROR: JWT secret must be at least 64 characters
```

**Solution**: Generate a longer secret with `openssl rand -base64 64`

### Service Not Healthy

```bash
⚠️ Warning: Auth service health check timeout
```

**Debug steps**:
```bash
# Check container logs
docker logs mhylle-auth-service

# Test health endpoint directly
docker exec mhylle-auth-service curl -f http://localhost:3000/health

# Check if service is listening
docker exec mhylle-auth-service netstat -tlnp | grep 3000
```

## 📚 Next Steps

After successful deployment:

1. **Test the service**: Visit `https://mhylle.com/api/auth/health`
2. **Integrate with apps**: Follow [INTEGRATION.md](docs/INTEGRATION.md)
3. **Change default admin password**: Login and update admin@mhylle.com password
4. **Review security**: Ensure all secrets are secure and properly configured

## 🆘 Support

For additional help:
- Check [ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design
- Review [API.md](docs/API.md) for endpoint documentation
- See main [CLAUDE.md](../CLAUDE.md) for development guidance