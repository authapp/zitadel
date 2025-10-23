---
trigger: always_on
---

1. The vision of the zitadel-backend project is to have complete feature parity with existing zitadel go backend
2. Whenever you are working on command module, source code or test cases, always maintain one file COMMAND_IMPLEMENTATION_STATUS.md which demonstrates how many commands have been implemented as per zitadel's command module and how many commands have been covered under test cases.
3. npm run test:unit to run unit test cases
4. npm run test:integration to run integration test cases
5. If any of the integration test case is failing run only that particular test case until it passes before running the entire integration suite