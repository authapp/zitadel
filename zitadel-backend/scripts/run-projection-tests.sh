#!/bin/bash
#
# Projection Test Runner - Tier by Tier Execution
# 
# Runs projection integration tests in dependency order with database reset
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test directory
TEST_DIR="test/integration/query/projections"

# Track results
TOTAL_TESTS=0
TOTAL_PASSED=0
TOTAL_FAILED=0

echo "🚀 Projection Test Runner - Tier by Tier Execution"
echo ""
echo "This will:"
echo "  1. Reset database and run migrations"
echo "  2. Run tests tier by tier in dependency order"
echo "  3. Generate comprehensive report"
echo ""

# Function to reset database and run migrations
reset_database() {
    echo -e "${BLUE}🔄 Resetting database and running migrations...${NC}"
    
    # Drop database (ignore errors if doesn't exist)
    echo "  - Dropping test database..."
    docker exec zitadel-test-db psql -U postgres -c "DROP DATABASE IF EXISTS zitadel_test" 2>/dev/null || true
    
    # Create database
    echo "  - Creating test database..."
    docker exec zitadel-test-db psql -U postgres -c "CREATE DATABASE zitadel_test"
    
    # Run migrations
    echo "  - Running migrations (clean schema)..."
    npm run test:integration -- test/integration/database/migration.integration.test.ts > /tmp/migration.log 2>&1
    
    if grep -q "PASS" /tmp/migration.log; then
        echo -e "  ${GREEN}✅ Migrations applied successfully${NC}\n"
    else
        echo -e "  ${RED}❌ Migration failed${NC}"
        cat /tmp/migration.log
        exit 1
    fi
}

# Function to run a single test file
run_test() {
    local test_file=$1
    local test_path="${TEST_DIR}/${test_file}"
    
    echo -e "\n${BLUE}▶️  Running: ${test_file}${NC}"
    echo "   ────────────────────────────────────────────────────────────────────"
    
    # Run test and capture output
    if npm run test:integration -- "$test_path" > /tmp/test_output.log 2>&1; then
        # Test passed
        local passed=$(grep -o '[0-9]* passed' /tmp/test_output.log | grep -o '[0-9]*' | head -1 || echo "0")
        echo -e "   ${GREEN}✅ PASS - ${passed} tests passed${NC}"
        TOTAL_PASSED=$((TOTAL_PASSED + passed))
        TOTAL_TESTS=$((TOTAL_TESTS + passed))
        return 0
    else
        # Test failed
        local passed=$(grep -o '[0-9]* passed' /tmp/test_output.log | grep -o '[0-9]*' | head -1 || echo "0")
        local failed=$(grep -o '[0-9]* failed' /tmp/test_output.log | grep -o '[0-9]*' | head -1 || echo "1")
        
        echo -e "   ${RED}❌ FAIL - ${passed} passed, ${failed} failed${NC}"
        
        # Show error details
        echo ""
        echo "   Error details:"
        grep -E "●|FAIL|Error:" /tmp/test_output.log | head -10 | sed 's/^/   /'
        
        TOTAL_PASSED=$((TOTAL_PASSED + passed))
        TOTAL_FAILED=$((TOTAL_FAILED + failed))
        TOTAL_TESTS=$((TOTAL_TESTS + passed + failed))
        return 1
    fi
}

# Function to run a tier
run_tier() {
    local tier_name=$1
    shift
    local tests=("$@")
    
    echo ""
    echo "================================================================================"
    echo "🎯 ${tier_name}"
    echo "================================================================================"
    echo ""
    echo "Tests to run: ${#tests[@]}"
    echo ""
    
    local tier_passed=0
    local tier_failed=0
    
    for test_file in "${tests[@]}"; do
        if run_test "$test_file"; then
            tier_passed=$((tier_passed + 1))
        else
            tier_failed=$((tier_failed + 1))
        fi
    done
    
    echo ""
    echo "================================================================================"
    echo "📊 ${tier_name} - Summary"
    echo "================================================================================"
    echo "Test Files: ${#tests[@]}"
    echo -e "${GREEN}✅ Passed: ${tier_passed}${NC}"
    echo -e "${RED}❌ Failed: ${tier_failed}${NC}"
    echo "================================================================================"
    echo ""
    
    return $tier_failed
}

# Reset database first
reset_database

# Tier 1: Base Projections
run_tier "Tier 1: Base Projections (No Dependencies)" \
    "instance-projection.integration.test.ts" \
    "org-projection.integration.test.ts" \
    "project-projection.integration.test.ts" \
    "user-projection.integration.test.ts"

TIER1_RESULT=$?

# Tier 2: Single-Dependency Projections
if [ $TIER1_RESULT -eq 0 ] || [ "$1" == "--continue" ]; then
    run_tier "Tier 2: Single-Dependency Projections" \
        "user-address-projection.integration.test.ts" \
        "user-metadata-projection.integration.test.ts" \
        "user-auth-method-projection.integration.test.ts" \
        "login-name-projection.integration.test.ts" \
        "personal-access-token-projection.integration.test.ts" \
        "session-projection.integration.test.ts" \
        "auth-request-projection.integration.test.ts" \
        "project-grant-projection.integration.test.ts" \
        "app-projection.integration.test.ts"
    
    TIER2_RESULT=$?
fi

# Tier 3: Multi-Dependency Projections
if [ $TIER2_RESULT -eq 0 ] || [ "$1" == "--continue" ]; then
    run_tier "Tier 3: Multi-Dependency Projections" \
        "member-projections.integration.test.ts" \
        "user-grant-projection.integration.test.ts"
    
    TIER3_RESULT=$?
fi

# Tier 4: Policy & Configuration
if [ $TIER3_RESULT -eq 0 ] || [ "$1" == "--continue" ]; then
    run_tier "Tier 4: Policy & Configuration Projections" \
        "login-policy-projection.integration.test.ts" \
        "password-policy-projection.integration.test.ts" \
        "lockout-policy-queries.integration.test.ts" \
        "security-notification-policy-projection.integration.test.ts" \
        "password-complexity-queries.integration.test.ts" \
        "domain-label-policy-projection.integration.test.ts" \
        "smtp-projection.integration.test.ts" \
        "sms-projection.integration.test.ts" \
        "mail-oidc-projection.integration.test.ts" \
        "idp-projection.integration.test.ts"
    
    TIER4_RESULT=$?
fi

# Tier 5: Advanced Features
if [ $TIER4_RESULT -eq 0 ] || [ "$1" == "--continue" ]; then
    run_tier "Tier 5: Advanced Features & System" \
        "actions-projection.integration.test.ts" \
        "authn-key-projection.integration.test.ts" \
        "quota-projection.integration.test.ts" \
        "milestones-projection.integration.test.ts" \
        "permission-queries.integration.test.ts"
    
    TIER5_RESULT=$?
fi

# Tier 6: System Tests
if [ $TIER5_RESULT -eq 0 ] || [ "$1" == "--continue" ]; then
    run_tier "Tier 6: Projection System Tests" \
        "projection-system.integration.test.ts" \
        "projection-lifecycle.test.ts" \
        "projection-enhanced-tracking.test.ts" \
        "projection-with-database.test.ts"
    
    TIER6_RESULT=$?
fi

# Final Summary
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "🎉 PROJECTION TEST EXECUTION COMPLETE"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "📈 Overall Statistics:"
echo "   Total Tests: ${TOTAL_TESTS}"
echo -e "   ${GREEN}✅ Passed: ${TOTAL_PASSED}${NC}"
echo -e "   ${RED}❌ Failed: ${TOTAL_FAILED}${NC}"

if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ($TOTAL_PASSED / $TOTAL_TESTS) * 100}")
    echo "   Pass Rate: ${PASS_RATE}%"
fi

echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# Exit with failure if any tests failed
if [ $TOTAL_FAILED -gt 0 ]; then
    exit 1
else
    exit 0
fi
