-- Migration: 002_14 - Create user addresses table
-- Description: Full address support for users (matches Zitadel's HumanAddress)
-- Date: 2025-10-05
-- Priority: 3 (Enhanced features)

CREATE TABLE IF NOT EXISTS user_addresses (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    instance_id VARCHAR(255) NOT NULL,
    
    -- Address fields (following Zitadel's HumanAddress structure)
    country VARCHAR(100),
    locality VARCHAR(255),           -- City
    postal_code VARCHAR(20),
    region VARCHAR(255),              -- State/Province
    street_address VARCHAR(500),
    formatted_address TEXT,           -- Full formatted address
    
    -- Address type and metadata
    address_type VARCHAR(50) DEFAULT 'primary',  -- primary, billing, shipping, other
    is_primary BOOLEAN DEFAULT false,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_user_addresses_user 
        FOREIGN KEY (user_id) 
        REFERENCES users_projection(id) 
        ON DELETE CASCADE
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS user_addresses_user_id_idx 
ON user_addresses(user_id);

CREATE INDEX IF NOT EXISTS user_addresses_instance_id_idx 
ON user_addresses(instance_id);

CREATE INDEX IF NOT EXISTS user_addresses_type_idx 
ON user_addresses(address_type);

-- Ensure only one primary address per user
CREATE UNIQUE INDEX IF NOT EXISTS user_addresses_primary_unique_idx 
ON user_addresses(user_id, instance_id) 
WHERE is_primary = true;

-- Add comments for documentation
COMMENT ON TABLE user_addresses IS 'User addresses following Zitadel HumanAddress structure';
COMMENT ON COLUMN user_addresses.locality IS 'City or locality';
COMMENT ON COLUMN user_addresses.region IS 'State, province, or region';
COMMENT ON COLUMN user_addresses.formatted_address IS 'Full formatted address string';
COMMENT ON COLUMN user_addresses.address_type IS 'Address type: primary, billing, shipping, other';
