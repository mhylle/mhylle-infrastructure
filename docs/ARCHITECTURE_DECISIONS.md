# Architecture Decision Records (ADR)

This document captures the key architectural decisions made during the authentication service implementation.

## ADR-001: Cookie-Based SSO vs Shared Libraries

**Date:** August 17, 2025  
**Status:** Accepted  
**Decision Makers:** Development Team  

### Context
We needed to implement single sign-on across multiple applications while adhering to strict deployment constraints:
- 1 application = 1 repository policy
- GitHub Actions-only deployment
- No manual server intervention allowed

### Options Considered

#### Option A: Shared NPM Library
- **Approach:** Create shared Angular library with auth components
- **Pros:** Consistent UI, shared validation logic, TypeScript support
- **Cons:** Violates 1-repo policy, npm version management complexity, build dependencies
- **Integration:** 3-5 lines per app (just import statements)

#### Option B: Cookie-Based SSO (Selected)
- **Approach:** Domain-wide HTTP-only cookies with JWT tokens
- **Pros:** No shared dependencies, browser-native SSO, better security, simple deployment
- **Cons:** Small amount of code duplication (~50 lines per app)
- **Integration:** ~50 lines per app (auth service, guards, interceptors)

#### Option C: Gateway-Level Authentication
- **Approach:** nginx auth_request module for centralized auth
- **Pros:** Zero auth code in apps, perfect security isolation
- **Cons:** Complex nginx config, hard to debug, performance impact on every request
- **Integration:** 0 lines per app (handled by nginx)

### Decision
**Selected Option B: Cookie-Based SSO**

### Rationale
1. **Deployment Compatibility:** Respects 1-repo-per-app constraint
2. **Security Superior:** HTTP-only cookies prevent XSS better than localStorage
3. **User Experience:** Seamless SSO across applications
4. **Maintainability:** Central auth logic with minimal app-specific code
5. **Performance:** No gateway bottleneck, client-side token validation

### Consequences
- Each app implements ~50 lines of auth code (acceptable duplication)
- Browser dependency on cookie support (universal in modern browsers)
- Domain limitation for SSO (acceptable for single-domain deployment)

---

## ADR-002: JWT Token Storage Location

**Date:** August 17, 2025  
**Status:** Accepted  

### Context
JWT tokens need secure storage that works across applications on the same domain.

### Options Considered

#### Option A: localStorage
- **Pros:** Easy to implement, persistent across browser sessions
- **Cons:** Vulnerable to XSS attacks, requires manual token management
- **Security:** Medium (vulnerable to script injection)

#### Option B: HTTP-only Cookies (Selected)
- **Pros:** XSS protection, automatic browser management, CSRF protection via SameSite
- **Cons:** Requires backend cookie management, CSRF considerations
- **Security:** High (not accessible via JavaScript)

#### Option C: SessionStorage
- **Pros:** Tab-scoped, cleared on tab close
- **Cons:** Still vulnerable to XSS, lost on tab close (poor UX)
- **Security:** Medium (vulnerable to script injection)

### Decision
**Selected Option B: HTTP-only Cookies**

### Configuration
```javascript
response.cookie('auth_token', jwt, {
  domain: '.mhylle.com',     // Domain-wide access
  httpOnly: true,           // XSS protection
  secure: true,             // HTTPS only
  sameSite: 'strict',       // CSRF protection
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
});
```

---

## ADR-003: Multi-Tenant Role Model

**Date:** August 17, 2025  
**Status:** Accepted  

### Context
Users need different roles in different applications (e.g., admin in app1, user in app2).

### Options Considered

#### Option A: Global Roles
- **Approach:** Single role per user across all applications
- **Pros:** Simple data model, easy to understand
- **Cons:** Cannot meet requirement for per-app permissions
- **Schema:** `users.role`

#### Option B: App-Scoped Roles (Selected)
- **Approach:** Role assignments per user per application
- **Pros:** Flexible permissions, meets all requirements
- **Cons:** More complex data model
- **Schema:** `user_app_roles(user_id, app_id, role)`

### Decision
**Selected Option B: App-Scoped Roles**

### Database Design
```sql
user_app_roles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  app_id VARCHAR NOT NULL,    -- 'app1', 'app2', etc.
  role VARCHAR NOT NULL,      -- 'admin', 'user', 'viewer'
  granted_at TIMESTAMP,
  granted_by UUID REFERENCES users(id),
  UNIQUE(user_id, app_id, role)
);
```

### JWT Integration
```json
{
  "apps": ["app1", "app2"],
  "roles": {
    "app1": ["admin"],
    "app2": ["user"]
  }
}
```

---

## ADR-004: Authentication Service Framework

**Date:** August 17, 2025  
**Status:** Accepted  

### Context
Need to choose backend framework for authentication service.

### Options Considered

#### Option A: Express.js
- **Pros:** Simple, minimal, well-known
- **Cons:** Manual setup for TypeScript, validation, database integration
- **Development Speed:** Slow (manual configuration)

#### Option B: NestJS (Selected)
- **Pros:** TypeScript-first, built-in validation, decorators, CLI tools, enterprise patterns
- **Cons:** Steeper learning curve, more opinionated
- **Development Speed:** Fast (scaffolding, built-in features)

#### Option C: Fastify
- **Pros:** High performance, TypeScript support
- **Cons:** Smaller ecosystem, less tooling
- **Development Speed:** Medium

### Decision
**Selected Option B: NestJS**

### Rationale
1. **TypeScript Integration:** Native TypeScript support with decorators
2. **Rapid Development:** CLI tools for scaffolding (modules, controllers, services)
3. **Built-in Features:** Validation, serialization, guards, interceptors
4. **Enterprise Patterns:** Dependency injection, modular architecture
5. **Consistency:** Matches existing application patterns

### CLI Usage
```bash
npx @nestjs/cli new auth-service
npx @nestjs/cli generate module auth
npx @nestjs/cli generate controller auth
npx @nestjs/cli generate service auth
npx @nestjs/cli generate resource users
```

---

## ADR-005: Password Security Strategy

**Date:** August 17, 2025  
**Status:** Accepted  

### Context
Password storage and validation requirements for production security.

### Options Considered

#### Option A: bcrypt (Selected)
- **Pros:** Industry standard, adaptive rounds, salt included
- **Cons:** Slower than alternatives (this is actually a feature)
- **Security:** High (designed to be slow)

#### Option B: Argon2
- **Pros:** Modern algorithm, winner of password hashing competition
- **Cons:** Less mature ecosystem, higher memory usage
- **Security:** Very High

#### Option C: PBKDF2
- **Pros:** NIST approved, built into Node.js
- **Cons:** More vulnerable to GPU attacks than bcrypt
- **Security:** Medium-High

### Decision
**Selected Option A: bcrypt with 12+ salt rounds**

### Implementation
```typescript
// Hashing
const saltRounds = 12;
const hashedPassword = await bcrypt.hash(password, saltRounds);

// Verification
const isValid = await bcrypt.compare(password, hashedPassword);
```

### Security Features
- Minimum 12 salt rounds (adjustable for future hardware improvements)
- Automatic salt generation
- Timing attack resistance
- Rainbow table protection

---

## ADR-006: Deployment Strategy

**Date:** August 17, 2025  
**Status:** Accepted  

### Context
Deployment must work within GitHub Actions constraints with zero manual intervention.

### Options Considered

#### Option A: Direct SSH Deployment (Selected)
- **Approach:** GitHub Actions SSH to server, docker pull, restart
- **Pros:** Simple, direct control, fits existing infrastructure
- **Cons:** Server access required, potential security concerns
- **Complexity:** Low

#### Option B: Container Registry + Webhooks
- **Approach:** Push to registry, webhook triggers server update
- **Pros:** More secure, declarative
- **Cons:** Additional infrastructure, webhook security
- **Complexity:** Medium

#### Option C: Kubernetes Deployment
- **Approach:** Deploy to k8s cluster with GitOps
- **Pros:** Scalable, modern, declarative
- **Cons:** Infrastructure overhead, complexity for simple use case
- **Complexity:** High

### Decision
**Selected Option A: Direct SSH Deployment**

### Implementation
```yaml
- name: Deploy to server
  uses: appleboy/ssh-action@v1.0.0
  with:
    host: ${{ secrets.SERVER_HOST }}
    username: ${{ secrets.SERVER_USER }}
    key: ${{ secrets.SERVER_SSH_KEY }}
    script: |
      cd /home/${{ secrets.SERVER_USER }}/mhylle.com
      git pull origin main
      docker-compose -f docker-compose.apps.yml up -d auth-service
```

### Security Measures
- SSH key-based authentication
- Secrets management via GitHub Secrets
- Health check verification after deployment
- Automatic rollback on failure

---

## ADR-007: API Rate Limiting Strategy

**Date:** August 17, 2025  
**Status:** Accepted  

### Context
Need to protect authentication endpoints from abuse while maintaining good user experience.

### Rate Limiting Configuration

#### Login Endpoint
- **Limit:** 5 attempts per minute per IP
- **Rationale:** Prevents brute force while allowing legitimate retries
- **Implementation:** nginx `limit_req_zone`

#### General API Endpoints
- **Limit:** 30 requests per minute per user
- **Rationale:** Generous for normal usage, prevents automated abuse
- **Implementation:** Application-level rate limiting

#### Health Check Endpoint
- **Limit:** No rate limiting
- **Rationale:** Monitoring and load balancers need unrestricted access

### nginx Configuration
```nginx
limit_req_zone $binary_remote_addr zone=auth_login:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=auth_api:10m rate=30r/m;

location = /api/auth/login {
    limit_req zone=auth_login burst=2 nodelay;
    # ... proxy configuration
}
```

---

## ADR-008: Documentation Strategy

**Date:** August 17, 2025  
**Status:** Accepted  

### Context
Complex authentication system requires comprehensive documentation for multiple audiences.

### Documentation Structure

#### Technical Documentation
- **ARCHITECTURE.md:** System design, component interactions, security model
- **API.md:** Complete endpoint reference with examples and error codes
- **INTEGRATION.md:** Step-by-step implementation guide for developers

#### Operational Documentation
- **README.md:** Quick start, deployment instructions, troubleshooting
- **CLAUDE.md:** AI assistant guidance for future development

#### Process Documentation
- **This ADR:** Decision rationale and context preservation

### Quality Standards
- **Code Examples:** All documentation includes working code examples
- **Error Scenarios:** Complete error handling and troubleshooting guides
- **Visual Aids:** Architecture diagrams and flow charts
- **Maintenance:** Documentation updated with code changes

---

## Summary

These architectural decisions collectively create a secure, scalable, and maintainable authentication system that respects deployment constraints while providing excellent user experience. The decisions prioritize:

1. **Security First:** HTTP-only cookies, bcrypt hashing, rate limiting
2. **Deployment Compatibility:** Respects 1-repo constraint and GitHub Actions
3. **Developer Experience:** Comprehensive docs, CLI tools, minimal integration code
4. **User Experience:** Seamless SSO across applications
5. **Future Flexibility:** Modular design allows for enhancements

The architecture successfully balances technical excellence with practical constraints, resulting in a production-ready authentication system.