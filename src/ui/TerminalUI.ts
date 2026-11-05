import chalk from "chalk";
import readline from "readline";
import { GameEngine } from "../engine/GameEngine.js";
import { CharacterNeeds, ActionConfig } from "../types/index.js";

export class TerminalUI {
  private rl: readline.Interface;

  constructor(private engine: GameEngine) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private clearScreen(): void {
    console.clear();
  }

  private renderProgressBar(
    value: number,
    label: string,
    invert = false
  ): string {
    const totalBars = 12;
    const filledBars = Math.round((value / 100) * totalBars);
    const emptyBars = totalBars - filledBars;

    let barColor = chalk.green;
    const isWorse = invert ? value < 30 : value > 70;
    const isMedium = invert
      ? value >= 30 && value <= 60
      : value >= 40 && value <= 70;

    if (isWorse) barColor = chalk.red;
    else if (isMedium) barColor = chalk.yellow;

    const bar =
      barColor("█".repeat(filledBars)) + chalk.gray("░".repeat(emptyBars));
    const padLabel = label.padEnd(11, " ");
    const num = String(Math.round(value)).padStart(3, " ") + "%";
    return `${padLabel} [${bar}] ${num}`;
  }

  public renderHUD(latestMessage?: string, aiUpdate?: { actionName: string; dialogue?: string } | null): void {
    this.clearScreen();
    const player = this.engine.getPlayer();
    const ai = this.engine.getAI();
    const roomDetails = this.engine.getCurrentRoomDetails();
    const fullTime = this.engine.timeEngine.getFormattedFull();
    const mood = this.engine.emotionEngine.getMoodSummary(player.id);

    console.log(
      chalk.cyan.bold(
        "╔════════════════════════════════════════════════════════════════════════════════╗"
      )
    );
    console.log(
      chalk.cyan.bold("║") +
        chalk.white.bold(
          `  🏡 PARAMETER-DRIVEN LIFE SIMULATION  •  ${fullTime}`.padEnd(80)
        ) +
        chalk.cyan.bold("║")
    );
    console.log(
      chalk.cyan.bold(
        "╠════════════════════════════════════════════════════════════════════════════════╣"
      )
    );

    // Location hierarchy
    const locStr = `India > MP > Jabalpur > Home > Ground Floor > ${roomDetails.room.name} > ${player.location.positionId}`;
    console.log(
      chalk.cyan.bold("║") +
        chalk.yellow(` 📍 Location: `) +
        chalk.white(locStr).padEnd(69) +
        chalk.cyan.bold("║")
    );

    // Body state
    const bodyStr = `Posture: ${player.body.posture.toUpperCase()} | Orientation: ${player.body.orientation} | Mood: ${mood}`;
    console.log(
      chalk.cyan.bold("║") +
        chalk.yellow(` 🧍 Body:     `) +
        chalk.white(bodyStr).padEnd(69) +
        chalk.cyan.bold("║")
    );

    console.log(
      chalk.cyan.bold(
        "╠────────────────────────────────────────────────────────────────────────────────╣"
      )
    );

    // Needs Dashboard
    const needs = player.needs;
    console.log(
      chalk.cyan.bold("║ ") +
        this.renderProgressBar(needs.hunger, "🍽️  Hunger", false) +
        "   " +
        this.renderProgressBar(needs.energy, "⚡ Energy", true) +
        chalk.cyan.bold(" ║")
    );
    console.log(
      chalk.cyan.bold("║ ") +
        this.renderProgressBar(needs.thirst, "💧 Thirst", false) +
        "   " +
        this.renderProgressBar(needs.sleepiness, "😴 Sleep", false) +
        chalk.cyan.bold(" ║")
    );
    console.log(
      chalk.cyan.bold("║ ") +
        this.renderProgressBar(needs.hygiene, "🧼 Hygiene", true) +
        "   " +
        this.renderProgressBar(needs.bladder, "🚽 Bladder", false) +
        chalk.cyan.bold(" ║")
    );

    console.log(
      chalk.cyan.bold(
        "╠════════════════════════════════════════════════════════════════════════════════╣"
      )
    );

    // Room Description & Ambience
    console.log(
      chalk.cyan.bold("║ ") +
        chalk.magenta.bold(`🛋️  ${roomDetails.room.name.toUpperCase()}`) +
        chalk.gray(` — ${roomDetails.room.description.slice(0, 68)}`)
    );
    console.log(
      chalk.cyan.bold("║ ") +
        chalk.italic.gray(`   "${roomDetails.ambience}"`)
    );

    // Other characters present
    const isAiHere = ai.location.roomId === player.location.roomId;
    if (isAiHere) {
      console.log(
        chalk.cyan.bold("║ ") +
          chalk.green.bold(
            `👤 Aria is here with you! (${ai.body.posture} at ${ai.location.positionId})`
          )
      );
    } else {
      console.log(
        chalk.cyan.bold("║ ") +
          chalk.gray(
            `ℹ️  Aria is currently in the ${ai.location.roomId.replace("_", " ")} (${ai.body.posture})`
          )
      );
    }

    // Nearby objects
    const objNames = roomDetails.objects
      .map((o) => {
        const stateObj = this.engine.stateManager.getObjectState(o.id);
        return `${o.icon} ${o.name} (${chalk.yellow(stateObj.state)})`;
      })
      .slice(0, 4)
      .join("  •  ");

    console.log(
      chalk.cyan.bold("║ ") +
        chalk.blue(`Objects: `) +
        chalk.white(objNames)
    );

    console.log(
      chalk.cyan.bold(
        "╚════════════════════════════════════════════════════════════════════════════════╝"
      )
    );

    // Latest action result / events
    if (latestMessage) {
      console.log(chalk.greenBright(`\n✨ ${latestMessage}`));
    }

    // AI action update & dialogue
    if (aiUpdate) {
      console.log(
        chalk.magentaBright(`\n🤖 [AI - Aria]: Did action '${aiUpdate.actionName}'`)
      );
      if (aiUpdate.dialogue) {
        console.log(chalk.yellowBright(`💬 "${aiUpdate.dialogue}"`));
      }
    }
  }

  public async promptUser(): Promise<void> {
    while (true) {
      const actions = this.engine.getAvailablePlayerActions();
      const ai = this.engine.getAI();
      const player = this.engine.getPlayer();
      const isAiHere = ai.location.roomId === player.location.roomId;

      console.log(chalk.white.bold("\nWhat would you like to do?"));

      let idx = 1;
      const optionMap: { actionId?: string; isTalk?: boolean; isInspect?: boolean }[] = [];

      for (const act of actions) {
        console.log(
          `  ${chalk.cyan(`[${idx}]`)} ${act.icon} ${act.name} ${chalk.gray(
            `— ${act.description}`
          )}`
        );
        optionMap.push({ actionId: act.id });
        idx++;
      }

      if (isAiHere) {
        console.log(`  ${chalk.cyan(`[${idx}]`)} 💬 Talk to Aria`);
        optionMap.push({ isTalk: true });
        idx++;
      }

      console.log(`  ${chalk.cyan(`[${idx}]`)} 🔍 Inspect JSON World State`);
      optionMap.push({ isInspect: true });
      idx++;

      console.log(`  ${chalk.cyan(`[0]`)} 🚪 Exit Simulation`);

      const answer = await this.askQuestion(chalk.yellow(`\nChoose option (0-${idx - 1}): `));
      const choiceNum = parseInt(answer.trim(), 10);

      if (isNaN(choiceNum) || choiceNum < 0 || choiceNum >= idx) {
        this.renderHUD(chalk.red("Invalid option! Please choose a number from the list."));
        continue;
      }

      if (choiceNum === 0) {
        console.log(chalk.green("\nThank you for playing Life Simulation! Goodbye. 👋\n"));
        this.rl.close();
        process.exit(0);
      }

      const selected = optionMap[choiceNum - 1];

      if (selected.isTalk) {
        const reply = this.engine.talkToAI();
        this.renderHUD(chalk.yellowBright(`💬 You talked to Aria:`), {
          actionName: "Conversation",
          dialogue: reply,
        });
        continue;
      }

      if (selected.isInspect) {
        const snapshot = this.engine.stateManager.getSnapshot();
        this.renderHUD(
          chalk.magentaBright(
            `\n📄 Authoritative JSON State Snapshot:\n` +
              JSON.stringify(
                {
                  time: snapshot.time,
                  player: snapshot.characters["player_001"],
                  ai: snapshot.characters["ai_001"],
                },
                null,
                2
              )
          )
        );
        continue;
      }

      if (selected.actionId) {
        const actionConfig = this.engine.configLoader.getAction(selected.actionId);
        let targetObjectId: string | undefined = undefined;

        if (actionConfig?.requiresTarget) {
          const roomDetails = this.engine.getCurrentRoomDetails();
          const targetCandidates = roomDetails.objects.filter(
            (o) =>
              !actionConfig.targetTypes ||
              actionConfig.targetTypes.includes(o.type)
          );
          if (targetCandidates.length > 0) {
            targetObjectId = targetCandidates[0].id;
          }
        }

        const { result, alerts, aiUpdate } = this.engine.submitPlayerAction(
          selected.actionId,
          targetObjectId
        );

        let msg = result.message;
        if (alerts.length > 0) {
          msg += "\n" + alerts.join("\n");
        }

        this.renderHUD(msg, aiUpdate);
      }
    }
  }

  private askQuestion(query: string): Promise<string> {
    return new Promise((resolve) => this.rl.question(query, resolve));
  }
}

