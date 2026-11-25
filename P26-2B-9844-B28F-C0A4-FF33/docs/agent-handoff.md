# Agent communication and handoff

## Workflow

1. **Serverless Architect** reads the serverless Skill and publishes the API contract proposal before dependent frontend work. The agent records endpoint, schema, authentication, and authorization decisions in `api-contract.md`.
2. **Frontend Vanilla Developer** reads the frontend Skill and the agreed contract. The agent consumes the contract and reports missing or incompatible backend behavior to the Serverless Architect; it does not silently redefine endpoints.
3. **Test and Validation Agent** reads the validation Skill and the same contract. After receiving the backend and frontend handoffs, it independently tests the agreed acceptance criteria and reports evidence, failures, and limitations.
4. The owner of a finding implements an authorized correction. QA then reruns the relevant checks and records the new result.

## Handoff contents

Each handoff should state:

- Work completed and files in scope.
- Contract or assumptions relied on.
- Validation performed, with commands and observable results.
- Known gaps, external configuration dependencies, and items not tested.
- The next agent and the specific action requested.

## Change coordination

- The Serverless Architect owns the API contract. Proposed changes must be recorded in `api-contract.md` and communicated to Frontend and QA before they rely on them.
- Frontend may propose a contract change but must not unilaterally change its meaning.
- QA validates against the agreed contract and reports defects; it does not implement application fixes.
- No agent may claim a test, deployment, external binding, credential, harness, or model is confirmed without evidence.
- The user authorizes scope and resolves decisions not determined by the README or current project documentation.

## Current configuration facts

- The repository-level Copilot profiles and Skills are under `.github/agents/` and `.github/skills/`.
- The original delivery Skills remain under `skills/` in the project folder. Keep the corresponding Copilot copies synchronized.
- Harness and model are unspecified until the user confirms them.
