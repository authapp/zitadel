-- Notification Configuration Tables
-- Based on Zitadel Go: internal/notification/repository/eventsourcing

-- Notification provider configurations
CREATE TABLE IF NOT EXISTS notification_providers (
    id VARCHAR(255) PRIMARY KEY,
    instance_id VARCHAR(255) NOT NULL,
    provider_type VARCHAR(50) NOT NULL, -- 'smtp', 'twilio', 'webhook', etc.
    config JSONB NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(instance_id, provider_type)
);

CREATE INDEX idx_notification_providers_instance ON notification_providers(instance_id);
CREATE INDEX idx_notification_providers_type ON notification_providers(provider_type);
CREATE INDEX idx_notification_providers_enabled ON notification_providers(enabled);

-- Email-specific configurations
CREATE TABLE IF NOT EXISTS email_configs (
    id VARCHAR(255) PRIMARY KEY,
    instance_id VARCHAR(255) NOT NULL,
    smtp_host VARCHAR(255),
    smtp_port INTEGER,
    smtp_user VARCHAR(255),
    smtp_password VARCHAR(255), -- Encrypted
    smtp_from VARCHAR(255),
    smtp_from_name VARCHAR(255),
    smtp_reply_to VARCHAR(255),
    smtp_secure BOOLEAN DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(instance_id)
);

CREATE INDEX idx_email_configs_instance ON email_configs(instance_id);
CREATE INDEX idx_email_configs_enabled ON email_configs(enabled);

-- SMS-specific configurations
CREATE TABLE IF NOT EXISTS sms_configs (
    id VARCHAR(255) PRIMARY KEY,
    instance_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'twilio', -- 'twilio', 'webhook'
    twilio_account_sid VARCHAR(255),
    twilio_auth_token VARCHAR(255), -- Encrypted
    twilio_phone_number VARCHAR(50),
    twilio_verify_service_sid VARCHAR(255),
    webhook_url VARCHAR(500),
    webhook_headers JSONB,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(instance_id)
);

CREATE INDEX idx_sms_configs_instance ON sms_configs(instance_id);
CREATE INDEX idx_sms_configs_provider ON sms_configs(provider);
CREATE INDEX idx_sms_configs_enabled ON sms_configs(enabled);

-- Configuration change log for audit
CREATE TABLE IF NOT EXISTS notification_config_changes (
    id VARCHAR(255) PRIMARY KEY,
    instance_id VARCHAR(255) NOT NULL,
    config_type VARCHAR(50) NOT NULL, -- 'email', 'sms', 'provider'
    config_id VARCHAR(255) NOT NULL,
    changed_by VARCHAR(255),
    changes JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_config_changes_instance ON notification_config_changes(instance_id);
CREATE INDEX idx_config_changes_type ON notification_config_changes(config_type);
CREATE INDEX idx_config_changes_created ON notification_config_changes(created_at);

-- Comments
COMMENT ON TABLE notification_providers IS 'Generic notification provider configurations per instance';
COMMENT ON TABLE email_configs IS 'Email/SMTP configurations per instance';
COMMENT ON TABLE sms_configs IS 'SMS provider configurations per instance';
COMMENT ON TABLE notification_config_changes IS 'Audit log for configuration changes';
