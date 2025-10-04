-- Migration: 002_04 - Create users projection table
-- Description: CQRS read model for users
-- Date: 2025-10-04

CREATE TABLE IF NOT EXISTS users_projection (
    id VARCHAR(255) PRIMARY KEY,
    instance_id VARCHAR(255) NOT NULL,
    resource_owner VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    phone VARCHAR(50),
    phone_verified BOOLEAN DEFAULT FALSE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    display_name VARCHAR(255),
    preferred_language VARCHAR(10),
    gender VARCHAR(50),
    avatar_url TEXT,
    state VARCHAR(50) NOT NULL DEFAULT 'active',
    password_hash TEXT,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT users_projection_unique_username UNIQUE (instance_id, username),
    CONSTRAINT users_projection_unique_email UNIQUE (instance_id, email)
);
