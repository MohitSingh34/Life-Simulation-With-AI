# 💻 Agent 5 Task: Study, Technology & Roommate Dynamics

## 🎯 Objective
Deepen the intellectual, creative, and interpersonal life of the home. Enhance the Study Room with meaningful learning and creative writing loops, and introduce natural social encounters and shared activities between **Mohit** and **Aria**.

---

## 📂 Governing Files to Read & Edit
- `src/config/rooms/study_room.json`
- `src/config/objects.json`
- `src/config/actions/daily_activities.json`
- `src/config/actions/interactions.json`
- `src/ai/AIDecisionEngine.ts` (Aria's autonomous reactions)
- `src/types/character.ts`

---

## 🛠️ Required Tasks

### 1. Subject-Specific Book Reading & Study Engine
Currently, all books execute a generic `read_book` action.
- Enhance reading with specific gains based on the book:
  - **Math Textbook (`math_book_001`)**: Solves calculus/linear algebra problems (+15 studiousness, +5 mental energy, -10 boredom).
  - **Physics Textbook (`physics_book_001`)**: Mechanics & thermodynamics study (+15 studiousness, -10 boredom).
  - **Psychology Book (`psychology_book_001`)**: Insights into human behavior & empathy (+15 sociability, -10 stress).
  - **Mohit's Notebook (`mohit_notebook_001`)**: Personal thoughts, project sketches (+10 happiness, -15 stress).
  - **Aria's Notebook (`aria_notebook_001`)**: ⚠️ Roommate boundary tension! Peeking into Aria's notebook triggers high guilt/stress (+20 stress) or friction if Aria is in the room.

### 2. Desktop PC Creative & Work Projects
- Expand PC capabilities beyond generic browsing:
  - **`code_project` (Software Development)**: Writing code, debugging, building software (+20 studiousness, +10 energy satisfaction, -15 boredom).
  - **`listen_lofi_music`**: Background ambient music while working at the desk (Stress -15, Happiness +10).

### 3. Roommate Social Encounters (Mohit & Aria)
Add rich interactive social actions when both characters are in the same room:
- **`offer_chai` (Share Morning/Evening Tea)**: Offer a cup of freshly brewed chai to Aria if both are in Kitchen or Living Room. Improves roommate rapport, softens tension.
- **`ask_about_day` (Casual Roommate Check-in)**: A short, natural check-in conversation.
- **`play_chess` (Quiet Game in Living Room or Study)**: A thoughtful 2-player board game encounter (requires coffee table or study desk).
- **`discuss_book` / `discuss_code`**: Seeking advice or sharing an interesting insight from reading/working.

---

## 🧪 Verification & Acceptance Criteria
1. Run `npx tsc --noEmit` — 0 TypeScript compilation errors.
2. Run `npm test` — all simulation tests pass with 100% success.
3. Test that reading individual books grants distinct rewards and that social actions are available when both characters share a room.
4. Document all changes in [`AGENTS/agent5_communication.md`](file:///home/no/applications/Game/life-simulation/AGENTS/agent5_communication.md).
