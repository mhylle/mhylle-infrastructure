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
('system', 'domain', 'mhylle.com', 'setup_script')
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
    RAISE NOTICE 'Created databases: mhylle_main, app1_db';
    RAISE NOTICE 'Created users: app_app1, mhylle_maintenance';
    RAISE NOTICE 'Created monitoring tables and functions';
END $$;
