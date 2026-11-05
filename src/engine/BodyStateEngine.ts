import { CharacterState } from "../types/index.js";

export type BodyStateResult = {
  pose: string;
  body: string;
};

type BodyTextGenerator = (context: {
  roomName: string;
  positionName: string;
  roomId: string;
}) => string;

export class BodyStateEngine {
  private readonly roomProfiles: Record<string, { label: string }> = {
    bedroom: { label: "bedroom" },
    kitchen: { label: "kitchen" },
    study_room: { label: "study room" },
    toilet: { label: "bathroom" },
    living_room: { label: "living room" },
  };

  private readonly positionProfiles: Record<string, { hint: string; posePrefix?: string }> = {
    bed: { hint: "on the bed" },
    bedside: { hint: "by the bedside", posePrefix: "beside the bed" },
    desk: { hint: "at the desk" },
    chair: { hint: "at the seat" },
    door: { hint: "by the doorway" },
    doorway: { hint: "by the doorway" },
    counter: { hint: "beside the counter" },
    stove: { hint: "beside the counter" },
    bookshelf: { hint: "by the shelf" },
    shelf: { hint: "by the shelf" },
    sink: { hint: "by the sink" },
    toilet: { hint: "by the bathroom fixture" },
  };

  public getCharacterBodyState(character: CharacterState): BodyStateResult {
    if (!character) {
      return {
        pose: "Idle",
        body: "The character is not present in the current simulation.",
      };
    }

    const roomId = character.location.roomId;
    const roomName = this.formatLabel(roomId);
    const positionName = this.formatLabel(character.location.positionId || "default_position");
    const posture = character.body.posture || "standing";

    const pose = this.buildPose(posture, roomName, positionName, roomId);
    const body = this.buildBody(posture, roomName, positionName, roomId);

    return { pose, body };
  }

  private buildPose(
    posture: string,
    roomName: string,
    positionName: string,
    roomId: string
  ): string {
    const postureMap: Record<string, string> = {
      lying: `Lying comfortably in ${roomName}`,
      sitting: `Sitting in ${roomName}`,
      standing: `Standing in ${roomName}`,
      kneeling: `Kneeling in ${roomName}`,
      squatting: `Squatting in ${roomName}`,
    };

    const specificPose = this.matchPositionRule(positionName, roomId, posture);
    return specificPose ?? postureMap[posture] ?? `Standing in ${roomName}`;
  }

  private buildBody(
    posture: string,
    roomName: string,
    positionName: string,
    roomId: string
  ): string {
    const roomHint = this.getPositionHint(positionName, roomId);

    const postureTemplates: Record<string, BodyTextGenerator> = {
      lying: ({ roomName, positionName }) => {
        const bedHint = roomName.toLowerCase() === "bedroom" ? "mattress" : "surface";
        const feature = positionName.toLowerCase().includes("bed") ? `on the ${bedHint}` : `in the ${roomName.toLowerCase()}`;
        return `Lying ${feature}, one shoulder resting deeper into the support while the legs settle loose and relaxed.`;
      },
      sitting: () => `Seated ${roomHint}, shoulders relaxed and weight balanced naturally as the body settles into its position.`,
      kneeling: () => `Knees grounded ${roomHint}, the torso gently angled forward while the body stays steady and composed.`,
      squatting: () => `Weight lowered ${roomHint}, knees bent and balance centered while the body remains calm and grounded.`,
      standing: () => `Weight shifted ${roomHint}, shoulders easy and arms relaxed, with the body positioned naturally for ${roomName.toLowerCase()}.`,
    };

    const generator = postureTemplates[posture] ?? postureTemplates.standing;
    return generator({ roomName, positionName, roomId });
  }

  private matchPositionRule(
    positionName: string,
    roomId: string,
    posture: string
  ): string | null {
    const normalized = positionName.toLowerCase();
    const room = roomId.toLowerCase();

    if (normalized.includes("door") || normalized.includes("doorway")) {
      return posture === "lying" ? `Lying in ${this.formatLabel(room)}` : `Standing in ${this.formatLabel(room)}`;
    }

    if (normalized.includes("bookshelf") || normalized.includes("shelf")) {
      return `Standing by the shelf in ${this.formatLabel(room)}`;
    }

    if (normalized.includes("counter") || normalized.includes("stove") || normalized.includes("sink")) {
      return `Standing beside the counter in ${this.formatLabel(room)}`;
    }

    if (normalized.includes("bed")) {
      return posture === "lying" ? `Lying comfortably in ${this.formatLabel(room)}` : `Sitting on the bed in ${this.formatLabel(room)}`;
    }

    return null;
  }

  private getPositionHint(positionName: string, roomId: string): string {
    const normalized = positionName.toLowerCase();

    for (const [key, profile] of Object.entries(this.positionProfiles)) {
      if (normalized.includes(key)) {
        return profile.hint;
      }
    }

    if (normalized.includes("door") || normalized.includes("doorway")) {
      return "by the doorway";
    }

    if (normalized.includes("desk") || normalized.includes("chair")) {
      return "at the seat";
    }

    if (normalized.includes("counter") || normalized.includes("stove")) {
      return "beside the counter";
    }

    if (normalized.includes("bookshelf") || normalized.includes("shelf")) {
      return "by the shelf";
    }

    if (normalized.includes("bed")) {
      return "on the bed";
    }

    if (roomId.toLowerCase().includes("study")) {
      return "in the study space";
    }

    return "in the room";
  }

  private formatLabel(value: string): string {
    const normalized = value
      .replace(/[_-]+/g, " ")
      .trim();

    if (!normalized) {
      return "Room";
    }

    return normalized
      .split(" ")
      .map((part) => {
        if (!part) return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  }
}
