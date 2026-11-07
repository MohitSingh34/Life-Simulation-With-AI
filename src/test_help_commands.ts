import assert from "node:assert/strict";
import { GameEngine } from "./engine/GameEngine.js";
import { executeHelpCommands } from "./ai/HelpCommandProcessor.js";

const engine = new GameEngine();
engine.init();

const help = executeHelpCommands(
  "Before &&help:actions&& between &&help:walk_to_kitchen&& and &&help:map,ui,place_object,coordinates_of_home_floor,fridge_001&& after",
  engine
);
assert.equal(help.hasCommands, true);
assert.match(help.response, /Before/);
assert.match(help.response, /between and after/);
assert.ok(help.outcomes.some((outcome) => outcome.includes("Action categories")));
assert.ok(help.outcomes.some((outcome) => outcome.includes("walk_to_kitchen")));
assert.ok(help.outcomes.some((outcome) => outcome.includes("coordinates_of_home_floor")));
assert.ok(help.outcomes.some((outcome) => outcome.includes("<dialogue>")));
assert.ok(help.outcomes.some((outcome) => outcome.includes("fridge_001") && outcome.includes("Object help")));

const unknown = executeHelpCommands("&&help:not_a_real_keyword&&", engine);
assert.equal(unknown.hasCommands, true);
assert.match(unknown.outcomes[0], /No help entry matches/);

console.log("Keyword-based Aria help command tests passed.");
