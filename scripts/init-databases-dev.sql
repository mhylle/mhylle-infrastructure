-- Development Database Initialization Script
-- Creates initial databases and users for development environment

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create auth user first
DO $$
BEGIN
    -- Create user
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'auth_user') THEN
        CREATE USER auth_user WITH PASSWORD 'auth_secure_password_change_me';
        RAISE NOTICE 'Created auth_user';
    END IF;
END $$;

-- Create auth database (must be outside function)
SELECT 'CREATE DATABASE auth_db OWNER auth_user' 
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'auth_db')\gexec

-- Grant privileges
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_database WHERE datname = 'auth_db') THEN
        GRANT ALL PRIVILEGES ON DATABASE auth_db TO auth_user;
        RAISE NOTICE 'Granted privileges on auth_db to auth_user';
    END IF;
END $$;

-- Create app1 user first
DO $$
BEGIN
    -- Create user
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'app_app1') THEN
        CREATE USER app_app1 WITH PASSWORD 'app1_secure_password_change_me';
        RAISE NOTICE 'Created app_app1 user';
    END IF;
END $$;

-- Create app1 database (must be outside function)
SELECT 'CREATE DATABASE app1_db OWNER app_app1' 
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'app1_db')\gexec

-- Grant privileges
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_database WHERE datname = 'app1_db') THEN
        GRANT ALL PRIVILEGES ON DATABASE app1_db TO app_app1;
        RAISE NOTICE 'Granted privileges on app1_db to app_app1';
    END IF;
END $$;

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

-- Create trigger function for updated_at columns
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

-- Insert default admin user with bcrypt hash for 'Admin123!'
INSERT INTO users (email, password_hash, first_name, last_name, is_active)
VALUES (
    'admin@mhylle.com',
    '$2b$12$vtr7sPLsJhKQSKTXBNvQoeUaz84XvcGqhLffD2gaXIqLC8kQNxZUG', -- bcrypt hash for 'Admin123!'
    'System',
    'Administrator',
    true
) ON CONFLICT (email) DO NOTHING;

-- Connect to app1_db to set up schema
\c app1_db;

-- Grant schema privileges to app user
GRANT ALL ON SCHEMA public TO app_app1;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_app1;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_app1;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_app1;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_app1;

-- Switch back to main database
\c mhylle_main_dev;

-- Print completion message
DO $$
BEGIN
    RAISE NOTICE 'Development database initialization completed successfully';
    RAISE NOTICE 'Created databases: auth_db, app1_db';
    RAISE NOTICE 'Created users: auth_user, app_app1';
    RAISE NOTICE 'Default admin user: admin@mhylle.com (password: Admin123!)';
END $$;