import { ConversationManager } from "./ConversationManager.js";

const AUTOMATIC_LOOP_COMMAND = /&&(start_automatic_message_loop|stop_automatic_message_loop)&&/gi;

export interface AutomaticMessageLoopResult {
  hasCommands: boolean;
  response: string;
  outcomes: string[];
  enabled: boolean;
}

export function executeAutomaticMessageLoopCommands(
  response: string,
  conversations: ConversationManager,
  conversationId: string
): AutomaticMessageLoopResult {
  const outcomes: string[] = [];
  let commandCount = 0;
  const cleanedResponse = response.replace(
    AUTOMATIC_LOOP_COMMAND,
    (_command, rawAction: string) => {
      commandCount++;
      const enabled = rawAction.toLowerCase() === "start_automatic_message_loop";
      conversations.setAutomaticMessageLoopEnabled(conversationId, enabled);
      outcomes.push(
        enabled
          ? "Optional automatic message loop started. The regular 10-minute idle check-ins continue regardless; while this loop is enabled, player messages are queued for Aria's next self-directed turn."
          : "Automatic message loop stopped."
      );
      return "";
    }
  );

  return {
    hasCommands: commandCount > 0,
    response: cleanedResponse.replace(/[ \t]{2,}/g, " ").trim(),
    outcomes,
    enabled: conversations.isAutomaticMessageLoopEnabled(conversationId),
  };
}
