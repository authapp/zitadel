---
trigger: always_on
---

1. The vision of the zitadel-backend project is to have complete feature parity with existing zitadel go backend
2. npm run test:unit to run unit test cases
3. npm run test:integration to run integration test cases
4. If any of the integration test case is failing run only that particular test case until it passes before running the entire integration suite.
5. Instead of increasing the timeout continuously in integration test check if projections or commands are working properly
6. Make sure that everytime a piece of code is written, ensure a unit or integration test case cover that code