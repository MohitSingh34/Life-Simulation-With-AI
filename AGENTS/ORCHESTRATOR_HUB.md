# 🏡 Antigravity Multi-Agent Orchestration Hub

Welcome to the multi-agent expansion system for the **Jabalpur Life Simulation**.  
As the Lead Orchestrator, Antigravity coordinates the architectural vision, verifies changes, and maintains simulation integrity across all sub-agents.

---

## 🎯 The Vision: A Warm, Truly Lived-In Jabalpur Home
We are expanding the home into an authentic, deeply comforting, and realistic living space shared between **Mohit** and **Aria**. Every action should carry sensory weight—the aroma of ginger-cardamom in morning chai, the cool breeze on the balcony looking over Jabalpur streets, changing into soft cotton kurtas after a hot shower, quiet parallel focus in the study, and shared domestic moments.

---

## 👥 Assigned Agent Roster

| Agent | Focus Area | Task Specification File | Communication File |
| :--- | :--- | :--- | :--- |
| **Agent 1** | **Culinary & Kitchen Life** | [`AGENTS/agent1_culinary_task.md`](file:///home/no/applications/Game/life-simulation/AGENTS/agent1_culinary_task.md) | [`AGENTS/agent1_communication.md`](file:///home/no/applications/Game/life-simulation/AGENTS/agent1_communication.md) |
| **Agent 2** | **Living Room & Balcony Expansion** | [`AGENTS/agent2_living_balcony_task.md`](file:///home/no/applications/Game/life-simulation/AGENTS/agent2_living_balcony_task.md) | [`AGENTS/agent2_communication.md`](file:///home/no/applications/Game/life-simulation/AGENTS/agent2_communication.md) |
| **Agent 3** | **Bedroom, Wardrobe & Self-Care** | [`AGENTS/agent3_bedroom_wardrobe_task.md`](file:///home/no/applications/Game/life-simulation/AGENTS/agent3_bedroom_wardrobe_task.md) | [`AGENTS/agent3_communication.md`](file:///home/no/applications/Game/life-simulation/AGENTS/agent3_communication.md) |
| **Agent 4** | **Grooming, Wellness & Chores** | [`AGENTS/agent4_grooming_chores_task.md`](file:///home/no/applications/Game/life-simulation/AGENTS/agent4_grooming_chores_task.md) | [`AGENTS/agent4_communication.md`](file:///home/no/applications/Game/life-simulation/AGENTS/agent4_communication.md) |
| **Agent 5** | **Study, Technology & Roommate Dynamics** | [`AGENTS/agent5_study_social_task.md`](file:///home/no/applications/Game/life-simulation/AGENTS/agent5_study_social_task.md) | [`AGENTS/agent5_communication.md`](file:///home/no/applications/Game/life-simulation/AGENTS/agent5_communication.md) |

---

## 🔄 Two-Way Communication Protocol
For each agent running in an independent Antigravity window:
1. **Read Task**: The agent reads its dedicated `agent*_task.md`.
2. **Log Progress**: The agent writes checkpoints, architectural decisions, and questions into `agent*_communication.md`.
3. **Verify**: Before finishing, the agent runs `npm test` and confirms zero TypeScript/runtime regressions.
4. **Handoff**: The agent logs its completion in `agent*_communication.md`.
5. **Review**: The Lead Orchestrator (Antigravity in main window) inspects the communication file, checks diffs, runs test suites, and integrates the work.
