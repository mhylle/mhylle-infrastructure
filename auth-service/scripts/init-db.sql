-- Create auth database schema
-- This script is run automatically when PostgreSQL container starts

-- Create UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Create user_app_roles table for multi-tenant roles
CREATE TABLE IF NOT EXISTS user_app_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app_id VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES users(id),
    CONSTRAINT unique_user_app_role UNIQUE(user_id, app_id, role)
);

-- Create indexes for user_app_roles
CREATE INDEX IF NOT EXISTS idx_user_app_roles_user_id ON user_app_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_app_roles_app_id ON user_app_roles(app_id);
CREATE INDEX IF NOT EXISTS idx_user_app_roles_role ON user_app_roles(role);

-- Create auth_events table for audit logging
CREATE TABLE IF NOT EXISTS auth_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    app_id VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for auth_events
CREATE INDEX IF NOT EXISTS idx_auth_events_user_id ON auth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_event_type ON auth_events(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_events_created_at ON auth_events(created_at DESC);

-- Create refresh_tokens table for JWT refresh tokens (optional)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- Create index for refresh_tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: Admin123!)
-- Note: This should be changed immediately after first login
-- Password hash is for 'Admin123!' using bcrypt with 12 rounds
INSERT INTO users (email, password_hash, first_name, last_name, is_active)
VALUES (
    'admin@mhylle.com',
    '$2b$12$mfsurxfGGqVfaE4GECOuVe7XnHECBteX3hrrfNxfFo8XtKQh5utPC',
    'Admin',
    'User',
    true
) ON CONFLICT (email) DO NOTHING;

-- Get the admin user ID
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    SELECT id INTO admin_user_id FROM users WHERE email = 'admin@mhylle.com';
    
    -- Grant admin access to app1 and app2
    INSERT INTO user_app_roles (user_id, app_id, role, granted_by)
    VALUES 
        (admin_user_id, 'app1', 'admin', admin_user_id),
        (admin_user_id, 'app2', 'admin', admin_user_id)
    ON CONFLICT DO NOTHING;
END $$;

-- Create view for user permissions (convenience)
CREATE OR REPLACE VIEW user_permissions AS
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.is_active,
    COALESCE(
        json_agg(
            DISTINCT jsonb_build_object(
                'app_id', uar.app_id,
                'role', uar.role
            )
        ) FILTER (WHERE uar.app_id IS NOT NULL),
        '[]'::json
    ) as permissions
FROM users u
LEFT JOIN user_app_roles uar ON u.id = uar.user_id
GROUP BY u.id, u.email, u.first_name, u.last_name, u.is_active;

-- Grant permissions to auth_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO auth_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO auth_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO auth_user;