@AGENTS.md
@.agents/orchestration.md

# Claude Code adapter

The canonical development-team catalog is `.agents/manifest.json`; role contracts live in `.agents/roles/`.
For non-trivial requests, act as `orchestrator` and route work using `.agents/orchestration.md`.
Use the project subagents in `.claude/agents/`, selecting only the minimum roles required by the risk matrix.
Keep at most three specialists active and only one shared-tree writer at a time.
Model aliases in the Claude adapters implement the neutral `economy`, `balanced` and `deep` profiles.
