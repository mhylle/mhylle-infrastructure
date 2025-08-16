# Application Integration Guide

This guide shows how to integrate your Angular applications with the authentication service using the cookie-based SSO approach.

## Overview

Each application implements minimal authentication code (~50 lines) that:
1. Checks for authentication cookies on startup
2. Provides login/logout functionality
3. Protects routes with auth guards
4. Adds authentication headers to API calls

**No shared libraries required** - just HTTP API calls to the auth service.

## Step 1: Create Auth Service

Create a simple authentication service in your Angular app:

```typescript
// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  permissions: {
    apps: string[];
    roles: Record<string, string[]>;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<UserInfo | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    // Check for existing session on app startup
    this.validateSession();
  }

  async validateSession(): Promise<UserInfo | null> {
    try {
      const response = await fetch('/api/auth/validate', {
        credentials: 'include' // Include cookies
      });
      
      if (response.ok) {
        const result = await response.json();
        const user = result.data;
        this.currentUserSubject.next(user);
        return user;
      }
    } catch (error) {
      console.error('Session validation failed:', error);
    }
    
    this.currentUserSubject.next(null);
    return null;
  }

  async login(credentials: LoginRequest): Promise<UserInfo> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify(credentials)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Login failed');
    }

    const result = await response.json();
    const user = result.data;
    this.currentUserSubject.next(user);
    return user;
  }

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    this.currentUserSubject.next(null);
  }

  getCurrentUser(): UserInfo | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  hasAppAccess(appId: string): boolean {
    const user = this.getCurrentUser();
    return user?.permissions.apps.includes(appId) || false;
  }

  hasRole(appId: string, role: string): boolean {
    const user = this.getCurrentUser();
    return user?.permissions.roles[appId]?.includes(role) || false;
  }
}
```

## Step 2: Create Auth Guard

Protect routes that require authentication:

```typescript
// src/app/guards/auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async canActivate(): Promise<boolean> {
    // Check if user is authenticated
    let user = this.authService.getCurrentUser();
    
    // If no user, try to validate session
    if (!user) {
      user = await this.authService.validateSession();
    }

    if (user) {
      // Check if user has access to this app
      if (this.authService.hasAppAccess('app1')) { // Replace 'app1' with your app ID
        return true;
      } else {
        // User is authenticated but doesn't have app access
        this.router.navigate(['/access-denied']);
        return false;
      }
    }

    // Not authenticated - show login
    this.showLogin();
    return false;
  }

  private showLogin(): void {
    // Trigger login modal or navigate to login page
    // Implementation depends on your UI approach
    const event = new CustomEvent('show-login');
    window.dispatchEvent(event);
  }
}
```

## Step 3: Create Login Component

Simple login form component:

```typescript
// src/app/components/login/login.component.ts
import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, LoginRequest } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-modal" [class.hidden]="!isVisible">
      <div class="login-form">
        <h2>Login</h2>
        
        <form (ngSubmit)="onSubmit()" #loginForm="ngForm">
          <div class="form-group">
            <label for="email">Email:</label>
            <input 
              type="email" 
              id="email" 
              name="email"
              [(ngModel)]="credentials.email" 
              required 
              #email="ngModel">
            <div *ngIf="email.invalid && email.touched" class="error">
              Email is required
            </div>
          </div>

          <div class="form-group">
            <label for="password">Password:</label>
            <input 
              type="password" 
              id="password" 
              name="password"
              [(ngModel)]="credentials.password" 
              required 
              #password="ngModel">
            <div *ngIf="password.invalid && password.touched" class="error">
              Password is required
            </div>
          </div>

          <div *ngIf="errorMessage" class="error">
            {{ errorMessage }}
          </div>

          <div class="form-actions">
            <button 
              type="submit" 
              [disabled]="loginForm.invalid || isLoading">
              {{ isLoading ? 'Logging in...' : 'Login' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    
    .login-modal.hidden {
      display: none;
    }
    
    .login-form {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      min-width: 300px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .form-group {
      margin-bottom: 1rem;
    }
    
    label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: bold;
    }
    
    input {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
    }
    
    button {
      width: 100%;
      padding: 0.75rem;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
    }
    
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    
    .error {
      color: #dc3545;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }
  `]
})
export class LoginComponent {
  @Output() loginSuccess = new EventEmitter<void>();
  
  isVisible = false;
  isLoading = false;
  errorMessage = '';
  
  credentials: LoginRequest = {
    email: '',
    password: ''
  };

  constructor(private authService: AuthService) {
    // Listen for login show events
    window.addEventListener('show-login', () => {
      this.show();
    });
  }

  show(): void {
    this.isVisible = true;
    this.errorMessage = '';
    this.credentials = { email: '', password: '' };
  }

  hide(): void {
    this.isVisible = false;
  }

  async onSubmit(): Promise<void> {
    if (this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.login(this.credentials);
      this.hide();
      this.loginSuccess.emit();
    } catch (error: any) {
      this.errorMessage = error.message || 'Login failed';
    } finally {
      this.isLoading = false;
    }
  }
}
```

## Step 4: Create HTTP Interceptor

Automatically handle authentication for API calls:

```typescript
// src/app/interceptors/auth.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Add credentials to all requests (for cookies)
    const authReq = req.clone({
      setHeaders: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Unauthorized - clear user and show login
          this.authService.logout();
          const event = new CustomEvent('show-login');
          window.dispatchEvent(event);
        }
        return throwError(() => error);
      })
    );
  }
}
```

## Step 5: Update App Configuration

Configure the authentication system in your app:

```typescript
// src/app/app.config.ts
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { routes } from './app.routes';
import { AuthInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ]
};
```

## Step 6: Update Routes

Add authentication guards to protected routes:

```typescript
// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { HomeComponent } from './pages/home/home.component';
import { HealthComponent } from './pages/health/health.component';
import { AccessDeniedComponent } from './pages/access-denied/access-denied.component';

export const routes: Routes = [
  { 
    path: '', 
    component: HomeComponent,
    canActivate: [AuthGuard] // Protect home page
  },
  { 
    path: 'health', 
    component: HealthComponent 
    // Health page is public
  },
  { 
    path: 'access-denied', 
    component: AccessDeniedComponent 
  },
  { 
    path: '**', 
    redirectTo: '' 
  }
];
```

## Step 7: Update App Component

Include login component and handle authentication state:

```typescript
// src/app/app.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AuthService, UserInfo } from './services/auth.service';
import { LoginComponent } from './components/login/login.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, LoginComponent],
  template: `
    <div class="app">
      <header *ngIf="currentUser">
        <h1>App1 - Welcome {{ currentUser.firstName }}!</h1>
        <div class="user-info">
          <span>{{ currentUser.email }}</span>
          <button (click)="logout()">Logout</button>
        </div>
      </header>
      
      <main>
        <router-outlet></router-outlet>
      </main>
      
      <app-login (loginSuccess)="onLoginSuccess()"></app-login>
    </div>
  `,
  styles: [`
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
    }
    
    .user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    
    button {
      padding: 0.5rem 1rem;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    main {
      padding: 2rem;
    }
  `]
})
export class AppComponent implements OnInit {
  currentUser: UserInfo | null = null;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // Subscribe to authentication state changes
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }

  onLoginSuccess(): void {
    // User successfully logged in
    // Router will automatically navigate to protected route
    console.log('Login successful');
  }
}
```

## Step 8: Create Access Denied Page

Handle cases where user is authenticated but lacks app access:

```typescript
// src/app/pages/access-denied/access-denied.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="access-denied">
      <h1>Access Denied</h1>
      <p>You don't have permission to access this application.</p>
      <p *ngIf="userEmail">
        User: {{ userEmail }}
      </p>
      <p>Please contact an administrator if you believe this is an error.</p>
      <button (click)="logout()">Logout</button>
    </div>
  `,
  styles: [`
    .access-denied {
      text-align: center;
      padding: 2rem;
      max-width: 500px;
      margin: 2rem auto;
    }
    
    h1 {
      color: #dc3545;
      margin-bottom: 1rem;
    }
    
    p {
      margin-bottom: 1rem;
      line-height: 1.5;
    }
    
    button {
      padding: 0.75rem 1.5rem;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
  `]
})
export class AccessDeniedComponent {
  userEmail: string | null = null;

  constructor(private authService: AuthService) {
    const user = this.authService.getCurrentUser();
    this.userEmail = user?.email || null;
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }
}
```

## Customization Options

### 1. App-Specific Role Checks
```typescript
// In your components
export class AdminComponent implements OnInit {
  canEdit = false;

  ngOnInit(): void {
    this.canEdit = this.authService.hasRole('app1', 'admin');
  }
}
```

### 2. Custom Error Handling
```typescript
// Enhanced auth service with better error handling
async login(credentials: LoginRequest): Promise<UserInfo> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials)
    });

    const result = await response.json();

    if (!response.ok) {
      // Handle specific error codes
      switch (result.error?.code) {
        case 'INVALID_CREDENTIALS':
          throw new Error('Invalid email or password');
        case 'USER_INACTIVE':
          throw new Error('Your account is inactive. Please contact support.');
        case 'RATE_LIMIT_EXCEEDED':
          throw new Error('Too many login attempts. Please try again later.');
        default:
          throw new Error(result.error?.message || 'Login failed');
      }
    }

    const user = result.data;
    this.currentUserSubject.next(user);
    return user;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error. Please check your connection.');
  }
}
```

### 3. Remember User Preference
```typescript
// Store UI preferences locally
export class AuthService {
  private readonly REMEMBER_EMAIL_KEY = 'remember_email';

  saveRememberedEmail(email: string): void {
    localStorage.setItem(this.REMEMBER_EMAIL_KEY, email);
  }

  getRememberedEmail(): string {
    return localStorage.getItem(this.REMEMBER_EMAIL_KEY) || '';
  }

  clearRememberedEmail(): void {
    localStorage.removeItem(this.REMEMBER_EMAIL_KEY);
  }
}
```

## Testing

### Unit Tests
```typescript
// auth.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
    
    // Mock fetch
    global.fetch = jest.fn();
  });

  it('should validate session successfully', async () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      permissions: { apps: ['app1'], roles: { app1: ['user'] } }
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockUser })
    });

    const result = await service.validateSession();
    expect(result).toEqual(mockUser);
    expect(service.getCurrentUser()).toEqual(mockUser);
  });
});
```

### E2E Tests
```typescript
// Use Playwright or Cypress to test complete authentication flows
describe('Authentication Flow', () => {
  it('should login and access protected page', async () => {
    await page.goto('/');
    
    // Should show login modal
    await expect(page.locator('.login-modal')).toBeVisible();
    
    // Fill login form
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    
    // Should be logged in and see protected content
    await expect(page.locator('header')).toContainText('Welcome Test!');
  });
});
```

## Troubleshooting

### Common Issues

1. **Cookies not working across apps**
   - Ensure auth service sets `domain: '.mhylle.com'`
   - Check CORS configuration includes credentials
   - Verify HTTPS is used in production

2. **Login modal not showing**
   - Check event listeners are properly set up
   - Verify auth guard is calling `showLogin()`
   - Check CSS z-index values

3. **Session not persisting**
   - Verify `credentials: 'include'` in all fetch calls
   - Check cookie expiration times
   - Ensure auth service is properly validating tokens

4. **Role checks failing**
   - Verify app ID matches exactly
   - Check JWT payload contains correct permissions
   - Ensure database has correct role assignments

This integration approach provides a clean, maintainable authentication system without shared library dependencies while maintaining excellent user experience and security.