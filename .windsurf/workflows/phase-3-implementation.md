---
description: 
auto_execution_mode: 1
---

1. Everytime read phase 3 implementation tracker md file and ensure it's up to date.
2. Pick up the next task that needs to be done in phase 3.
3. If the task turns out to be lot of changes, break the task into smaller task and update the tracker file and implement the smaller tasks.
4. For every implementation, ensure that, unit and integration test cases are written. Integration test cases should follow similar pattern like the existing test cases.
5. If the projection doesn't exists for commands, implement projections and use projection query in end to end test cases.
6. Never proceed to next task until all unit and integration test cases pass.
7. Commit the changes by auto generating the commit message after every task or sub task
8. Update the implementation tracker file with latest state and continue from point 1.
9. Repeat until phase 3 is entirely complete.