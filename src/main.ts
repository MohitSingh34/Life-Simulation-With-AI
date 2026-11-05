import readline from "readline";
import { createServer } from "./server.js";
import { GameEngine } from "./engine/GameEngine.js";
import { TerminalUI } from "./ui/TerminalUI.js";

async function main() {
  const args = process.argv.slice(2);

  // If explicit flag passed:
  if (args.includes("--terminal") || args.includes("-t")) {
    runTerminalMode();
    return;
  }
  if (args.includes("--web") || args.includes("-w")) {
    runWebMode();
    return;
  }

  // Interactive selection prompt
  console.log("\n=======================================================");
  console.log("   🏡 PARAMETER-DRIVEN LIFE SIMULATION (Jabalpur, India)");
  console.log("=======================================================\n");
  console.log("How would you like to play?");
  console.log("  [1] 🌐 Browser Mode (Modern Web Dashboard with interactive floorplan) [Recommended]");
  console.log("  [2] 💻 Terminal Mode (Text HUD inside this terminal)\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Select mode (1 or 2, default is 1): ", (answer) => {
    rl.close();
    const trimmed = answer.trim();
    if (trimmed === "2") {
      runTerminalMode();
    } else {
      runWebMode();
    }
  });
}

function runWebMode() {
  const port = parseInt(process.env.PORT || "3000", 10);
  createServer(port);
}

async function runTerminalMode() {
  console.log("\nStarting Terminal HUD Mode...\n");
  const engine = new GameEngine();
  engine.init();

  const ui = new TerminalUI(engine);
  ui.renderHUD("Simulation initialized successfully! Welcome to your morning in Jabalpur.");
  await ui.promptUser();
}

main().catch((err) => {
  console.error("Simulation error:", err);
  process.exit(1);
});
