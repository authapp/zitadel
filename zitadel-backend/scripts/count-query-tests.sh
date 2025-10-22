#!/bin/bash

echo "=== Query Module Test Count by Tier ==="
echo ""

echo "Tier 1: Foundation"
npm run test:unit -- --testPathPattern="(search|filter|converters|helpers|pagination|sort|projection/.*test|queries.test)" --silent 2>&1 | grep "Tests:"

echo ""
echo "Tier 2: Core CQRS (User, Org, Project, App, Instance, Session)"
npm run test:unit -- --testPathPattern="(user-queries.test|org-queries.test|project/project-queries|app/app-queries|instance/instance-queries|session/session-queries)" --silent 2>&1 | grep "Tests:"

echo ""
echo "Tier 3: Authentication (IDP, Login, Auth Methods)"
npm run test:unit -- --testPathPattern="(idp/idp-queries|idp-template|login-policy|auth-request|authn-key|access-token)" --silent 2>&1 | grep "Tests:"

echo ""
echo "Tier 4: Authorization (Grants, Members, Permissions, Roles)"
npm run test:unit -- --testPathPattern="(user-grant|project-grant|member/member-queries|permission|member-roles|user-membership)" --silent 2>&1 | grep "Tests:"

echo ""
echo "Tier 5: Advanced Features (Policies, SMS, SMTP, Actions, etc)"
npm run test:unit -- --testPathPattern="(policy|sms|smtp|action|features|admin|text|milestone|quota|notification|device|restriction|user-schema)" --silent 2>&1 | grep "Tests:"

echo ""
echo "=== Integration Tests ==="
npm run test:integration -- --testPathPattern="query" --silent 2>&1 | grep "Tests:"
