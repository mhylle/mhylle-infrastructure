-- PostgreSQL Database Initialization Script for mhylle.com Infrastructure
-- Creates initial databases and users for applications
-- This script runs automatically when PostgreSQL container starts for the first time

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create application databases and users
-- Note: Additional databases will be created by the deploy-app.sh script

-- Create app1 database and user (example application)
DO $$
BEGIN
    -- Create database
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'app1_db') THEN
        CREATE DATABASE app1_db;
    END IF;
    
    -- Create user
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'app_app1') THEN
        CREATE USER app_app1 WITH PASSWORD 'app1_secure_password_change_me';
    END IF;
    
    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE app1_db TO app_app1;
END $$;

-- Create auth database and user (authentication service)
DO $$
BEGIN
    -- Create database
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'auth_db') THEN
        CREATE DATABASE auth_db;
    END IF;
    
    -- Create user
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'auth_user') THEN
        CREATE USER auth_user WITH PASSWORD 'auth_secure_password_change_me';
    END IF;
    
    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE auth_db TO auth_user;
END $$;

-- Connect to app1_db to set up schema
\c app1_db;

-- Grant schema privileges to app user
GRANT ALL ON SCHEMA public TO app_app1;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_app1;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_app1;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_app1;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_app1;

-- Create common tables that might be useful across applications
CREATE TABLE IF NOT EXISTS app_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_name VARCHAR(50) NOT NULL,
    version VARCHAR(20),
    deployed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_app_metadata_app_name ON app_metadata(app_name);
CREATE INDEX IF NOT EXISTS idx_app_metadata_deployed_at ON app_metadata(deployed_at);

-- Insert initial metadata
INSERT INTO app_metadata (app_name, version, config) 
VALUES ('app1', '1.0.0', '{"environment": "production", "features": []}')
ON CONFLICT DO NOTHING;

-- Connect to auth_db to set up authentication schema
\c auth_db;

-- Grant schema privileges to auth user
GRANT ALL ON SCHEMA public TO auth_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO auth_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO auth_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO auth_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO auth_user;

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

-- Create indexes on users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

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
CREATE INDEX IF NOT EXISTS idx_user_app_roles_granted_at ON user_app_roles(granted_at);

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
CREATE INDEX IF NOT EXISTS idx_auth_events_app_id ON auth_events(app_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_created_at ON auth_events(created_at DESC);

-- Create refresh_tokens table for JWT refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for refresh_tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_created_at ON refresh_tokens(created_at);

-- Create trigger function for updated_at columns (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for user permissions
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
                'role', uar.role,
                'granted_at', uar.granted_at
            )
        ) FILTER (WHERE uar.app_id IS NOT NULL),
        '[]'::json
    ) as permissions
FROM users u
LEFT JOIN user_app_roles uar ON u.id = uar.user_id
GROUP BY u.id, u.email, u.first_name, u.last_name, u.is_active;

-- Grant permissions on view
GRANT SELECT ON user_permissions TO auth_user;

-- Insert default admin user with bcrypt hash for 'Admin123!'
INSERT INTO users (email, password_hash, first_name, last_name, is_active)
VALUES (
    'admin@mhylle.com',
    '$2b$12$vMK6/aL.T7lqsQOJEhX3ZOXvYkpg8CmY7YxPfbRkfQCrJBPHEk8GW', -- bcrypt hash for 'Admin123!'
    'System',
    'Administrator',
    true
) ON CONFLICT (email) DO NOTHING;

-- Grant admin access to all applications
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    SELECT id INTO admin_user_id FROM users WHERE email = 'admin@mhylle.com';
    
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO user_app_roles (user_id, app_id, role, granted_by)
        VALUES 
            (admin_user_id, 'app1', 'admin', admin_user_id),
            (admin_user_id, 'app2', 'admin', admin_user_id),
            (admin_user_id, 'auth-service', 'admin', admin_user_id)
        ON CONFLICT (user_id, app_id, role) DO NOTHING;
    END IF;
END $$;

-- Switch back to main database
\c mhylle_main;

-- Create monitoring and logging tables in main database
CREATE TABLE IF NOT EXISTS deployment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_name VARCHAR(50) NOT NULL,
    deployment_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'success', 'failed', 'rolled_back')),
    frontend_image VARCHAR(255),
    backend_image VARCHAR(255),
    version VARCHAR(50),
    deployed_by VARCHAR(100),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB
);

-- Create indexes for deployment logs
CREATE INDEX IF NOT EXISTS idx_deployment_logs_app_name ON deployment_logs(app_name);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_status ON deployment_logs(status);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_started_at ON deployment_logs(started_at);

-- Create application health status table
CREATE TABLE IF NOT EXISTS app_health_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_name VARCHAR(50) NOT NULL,
    component VARCHAR(50) NOT NULL CHECK (component IN ('frontend', 'backend', 'database')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'unhealthy', 'unknown')),
    last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB
);

-- Create indexes for health status
CREATE INDEX IF NOT EXISTS idx_app_health_app_name ON app_health_status(app_name);
CREATE INDEX IF NOT EXISTS idx_app_health_component ON app_health_status(component);
CREATE INDEX IF NOT EXISTS idx_app_health_status ON app_health_status(status);
CREATE INDEX IF NOT EXISTS idx_app_health_last_check ON app_health_status(last_check);

-- Create unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_health_unique 
ON app_health_status(app_name, component);

-- Create application configuration table
CREATE TABLE IF NOT EXISTS app_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_name VARCHAR(50) NOT NULL,
    config_key VARCHAR(100) NOT NULL,
    config_value TEXT NOT NULL,
    is_secret BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100)
);

-- Create indexes for configurations
CREATE INDEX IF NOT EXISTS idx_app_config_app_name ON app_configurations(app_name);
CREATE INDEX IF NOT EXISTS idx_app_config_key ON app_configurations(config_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_config_unique 
ON app_configurations(app_name, config_key);

-- Create database maintenance functions
-- Function to clean old deployment logs (keep last 1000 per app)
CREATE OR REPLACE FUNCTION cleanup_old_deployment_logs()
RETURNS void AS $$
DECLARE
    app_record RECORD;
BEGIN
    FOR app_record IN SELECT DISTINCT app_name FROM deployment_logs LOOP
        DELETE FROM deployment_logs 
        WHERE app_name = app_record.app_name 
        AND id NOT IN (
            SELECT id FROM deployment_logs 
            WHERE app_name = app_record.app_name 
            ORDER BY started_at DESC 
            LIMIT 1000
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old health status records (keep last 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_health_status()
RETURNS void AS $$
BEGIN
    DELETE FROM app_health_status 
    WHERE last_check < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Create update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS trigger_app_configurations_updated_at ON app_configurations;
CREATE TRIGGER trigger_app_configurations_updated_at
    BEFORE UPDATE ON app_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial system configuration
INSERT INTO app_configurations (app_name, config_key, config_value, created_by) VALUES
('system', 'infrastructure_version', '1.0.0', 'setup_script'),
('system', 'postgres_version', '15', 'setup_script'),
('system', 'nginx_version', 'alpine', 'setup_script'),
('system', 'domain', 'mhylle.com', 'setup_script'),
('auth-service', 'database_name', 'auth_db', 'setup_script'),
('auth-service', 'database_user', 'auth_user', 'setup_script'),
('auth-service', 'service_port', '3000', 'setup_script'),
('auth-service', 'api_prefix', '/api/auth', 'setup_script'),
('auth-service', 'version', '1.0.0', 'setup_script')
ON CONFLICT (app_name, config_key) DO NOTHING;

-- Create views for monitoring
CREATE OR REPLACE VIEW v_app_status AS
SELECT 
    app_name,
    MAX(CASE WHEN component = 'frontend' THEN status END) as frontend_status,
    MAX(CASE WHEN component = 'backend' THEN status END) as backend_status,
    MAX(CASE WHEN component = 'database' THEN status END) as database_status,
    MAX(last_check) as last_health_check
FROM app_health_status 
GROUP BY app_name;

CREATE OR REPLACE VIEW v_recent_deployments AS
SELECT 
    app_name,
    deployment_id,
    status,
    version,
    started_at,
    completed_at,
    (completed_at - started_at) as duration
FROM deployment_logs 
WHERE started_at > NOW() - INTERVAL '7 days'
ORDER BY started_at DESC;

-- Grant permissions on views
GRANT SELECT ON v_app_status TO PUBLIC;
GRANT SELECT ON v_recent_deployments TO PUBLIC;

-- Create maintenance user for automated tasks
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'mhylle_maintenance') THEN
        CREATE USER mhylle_maintenance WITH PASSWORD 'maintenance_secure_password_change_me';
    END IF;
END $$;

-- Grant necessary permissions to maintenance user
GRANT SELECT, INSERT, UPDATE, DELETE ON deployment_logs TO mhylle_maintenance;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_health_status TO mhylle_maintenance;
GRANT SELECT ON app_configurations TO mhylle_maintenance;
GRANT EXECUTE ON FUNCTION cleanup_old_deployment_logs() TO mhylle_maintenance;
GRANT EXECUTE ON FUNCTION cleanup_old_health_status() TO mhylle_maintenance;

-- Print completion message
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully';
    RAISE NOTICE 'Created databases: mhylle_main, app1_db, auth_db';
    RAISE NOTICE 'Created users: app_app1, auth_user, mhylle_maintenance';
    RAISE NOTICE 'Created authentication tables: users, user_app_roles, auth_events, refresh_tokens';
    RAISE NOTICE 'Default admin user: admin@mhylle.com (password: Admin123!)';
    RAISE NOTICE 'Created monitoring tables and functions';
END $$;
