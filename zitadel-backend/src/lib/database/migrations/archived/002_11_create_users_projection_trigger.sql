-- Migration: 002_11 - Trigger for auto-updating users_projection updated_at
DROP TRIGGER IF EXISTS update_users_projection_updated_at ON users_projection;
CREATE TRIGGER update_users_projection_updated_at BEFORE UPDATE ON users_projection
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
