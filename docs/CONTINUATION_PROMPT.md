# Claude Code Continuation Prompt

Copy and paste this prompt to continue the authentication implementation in a new session:

---

## 🎯 **Context: Authentication Service Integration**

I'm continuing the implementation of a centralized authentication system for the mhylle.com infrastructure. The authentication service has been successfully deployed and is ready for app integration.

### **Current Status**
- ✅ **Auth Service**: Deployed and running at `https://mhylle.com/api/auth/`
- ✅ **Database**: Initialized with user tables and default admin
- ✅ **Documentation**: Complete architecture, API, and integration guides
- ✅ **Multi-Repository**: Supports independent app deployments

### **Next Phase: App Integration**
I need to integrate the authentication service into the existing applications:

1. **App1 Integration** (~50 lines): Add auth service, guards, login components
2. **App2 Integration** (~50 lines): Same pattern as app1  
3. **SSO Testing**: Verify cross-app single sign-on functionality

### **Key Technical Details**

**Architecture**: Cookie-based SSO with domain-wide HTTP-only cookies (`.mhylle.com`)

**Integration Pattern** (per app):
- Auth service (~15 lines)
- Auth guard (~20 lines)  
- Login component (~15 lines)

**API Endpoints**:
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/validate` - Check current session
- `POST /api/auth/logout` - Domain-wide logout

**Default Credentials**:
- Email: `admin@mhylle.com`
- Password: `Admin123!`

**Repository Structure**:
- `mhylle-infrastructure`: Auth service, nginx, PostgreSQL (this repo)
- `mhylle-app1`: Independent Angular/NestJS app (separate repo)
- `mhylle-app2`: Independent Angular/NestJS app (separate repo)

### **Available Documentation**
- `auth-service/docs/INTEGRATION.md` - Complete integration guide with code examples
- `auth-service/docs/API.md` - Full API reference
- `docs/CURRENT_SESSION_CONTEXT.md` - Detailed current state
- `docs/ARCHITECTURE_DECISIONS.md` - Technical decisions and rationale

### **What I Need**

Please help me integrate the authentication service into app1 and app2, following the ~50 lines per app pattern described in the integration documentation. Start with app1, then app2, and finally test the cross-app SSO functionality.

The auth service is production-ready and waiting for frontend integration. All backend work is complete.

---

**Instructions**: Use this prompt in a new Claude Code session to continue seamlessly from where we left off.