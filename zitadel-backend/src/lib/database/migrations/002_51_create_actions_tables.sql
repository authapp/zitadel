-- Migration: Create Actions and Executions Tables
-- Description: Add tables for workflow actions and their execution tracking
-- Version: 002_51
-- Date: 2025-10-23

-- Actions table: Stores workflow actions that can be triggered by events
CREATE TABLE IF NOT EXISTS projections.actions (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence BIGINT NOT NULL,
    
    -- Action metadata
    name TEXT NOT NULL,
    script TEXT NOT NULL,
    timeout INTERVAL NOT NULL DEFAULT '10 seconds',
    allowed_to_fail BOOLEAN NOT NULL DEFAULT false,
    
    -- State
    state SMALLINT NOT NULL DEFAULT 1, -- 1=active, 2=inactive
    
    PRIMARY KEY (instance_id, id)
);

-- Indexes for actions
CREATE INDEX IF NOT EXISTS idx_actions_resource_owner 
    ON projections.actions(resource_owner, instance_id);

CREATE INDEX IF NOT EXISTS idx_actions_state 
    ON projections.actions(instance_id, state);

CREATE INDEX IF NOT EXISTS idx_actions_change_date 
    ON projections.actions(instance_id, change_date DESC);

-- Action flows table: Maps actions to event triggers
CREATE TABLE IF NOT EXISTS projections.action_flows (
    flow_type TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    action_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence BIGINT NOT NULL,
    
    -- Trigger configuration
    trigger_sequence SMALLINT NOT NULL DEFAULT 0,
    
    PRIMARY KEY (instance_id, flow_type, trigger_type, action_id)
);

-- Indexes for action_flows
CREATE INDEX IF NOT EXISTS idx_action_flows_action 
    ON projections.action_flows(instance_id, action_id);

CREATE INDEX IF NOT EXISTS idx_action_flows_trigger 
    ON projections.action_flows(instance_id, flow_type, trigger_type);

-- Executions table: Tracks action execution history
CREATE TABLE IF NOT EXISTS projections.executions (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    action_id TEXT NOT NULL,
    
    -- Execution metadata
    creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT NOT NULL,
    event_sequence BIGINT NOT NULL,
    
    -- Execution details
    targets JSONB, -- Array of targets (methods, functions, webhooks)
    
    PRIMARY KEY (instance_id, id)
);

-- Indexes for executions
CREATE INDEX IF NOT EXISTS idx_executions_aggregate 
    ON projections.executions(instance_id, aggregate_type, aggregate_id);

CREATE INDEX IF NOT EXISTS idx_executions_action 
    ON projections.executions(instance_id, action_id);

CREATE INDEX IF NOT EXISTS idx_executions_date 
    ON projections.executions(instance_id, creation_date DESC);

CREATE INDEX IF NOT EXISTS idx_executions_event 
    ON projections.executions(instance_id, event_type, event_sequence);

-- Execution states table: Tracks execution progress and results
CREATE TABLE IF NOT EXISTS projections.execution_states (
    execution_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    
    -- State tracking
    state SMALLINT NOT NULL DEFAULT 0, -- 0=pending, 1=running, 2=success, 3=failed, 4=timeout
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    
    -- Error tracking
    error_message TEXT,
    retry_count SMALLINT NOT NULL DEFAULT 0,
    
    -- Response data
    response JSONB,
    
    PRIMARY KEY (instance_id, execution_id, target_id)
);

-- Indexes for execution_states
CREATE INDEX IF NOT EXISTS idx_execution_states_execution 
    ON projections.execution_states(instance_id, execution_id);

CREATE INDEX IF NOT EXISTS idx_execution_states_state 
    ON projections.execution_states(instance_id, state);

CREATE INDEX IF NOT EXISTS idx_execution_states_finished 
    ON projections.execution_states(instance_id, finished_at DESC)
    WHERE finished_at IS NOT NULL;

-- Comments
COMMENT ON TABLE projections.actions IS 'Workflow actions that can be triggered by events';
COMMENT ON TABLE projections.action_flows IS 'Maps actions to event triggers';
COMMENT ON TABLE projections.executions IS 'Action execution history';
COMMENT ON TABLE projections.execution_states IS 'Tracks execution progress and results for each target';
