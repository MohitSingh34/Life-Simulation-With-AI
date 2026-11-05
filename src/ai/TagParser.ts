/**
 * TagParser
 * Parses XML-style tags returned by the AI into structured variables
 * that can be bound to UI elements and game state.
 */

export interface ParsedAiEdits {
  dialogue?: string;
  player_body?: string;
  player_pose?: string;
  player_mood?: string;
  room_ambience?: string;
  ai_activity?: string;
  [key: string]: string | undefined;
}

export interface ParseResult {
  raw: string;
  dialogue: string;
  edits: ParsedAiEdits;
}

export class TagParser {
  /**
   * Extract all <tag>value</tag> pairs from text.
   * If no <dialogue> tag exists, the remaining untagged text or full text is treated as dialogue.
   */
  public static parse(raw: string): ParseResult {
    const edits: ParsedAiEdits = {};
    const tagRegex = /<([a-zA-Z0-9_-]+)>([\s\S]*?)<\/\1>/gi;

    let match: RegExpExecArray | null;
    let hasTags = false;

    while ((match = tagRegex.exec(raw)) !== null) {
      hasTags = true;
      const tag = match[1].toLowerCase().replace(/-/g, "_");
      const content = match[2].trim();
      edits[tag] = content;
    }

    let dialogue = edits.dialogue;

    // If no <dialogue> tag was explicitly used, extract text outside of known tags or use whole raw string
    if (!dialogue) {
      if (hasTags) {
        // Strip out the matched tags to see if there is leftover speech
        const stripped = raw.replace(tagRegex, "").trim();
        dialogue = stripped || "Aria smiles warmly.";
      } else {
        dialogue = raw.trim();
      }
    }

    return {
      raw,
      dialogue,
      edits,
    };
  }
}

