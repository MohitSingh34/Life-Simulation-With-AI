import { SimulationEvent } from "../types/index.js";

export class EventManager {
  private events: SimulationEvent[] = [];
  private nextId = 1;

  public recordEvent(
    data: Omit<SimulationEvent, "id" | "realTime">
  ): SimulationEvent {
    const event: SimulationEvent = {
      id: `evt_${String(this.nextId++).padStart(4, "0")}`,
      realTime: new Date().toISOString(),
      ...data,
    };
    this.events.push(event);
    return event;
  }

  public logEvent(data: {
    actorId: string;
    actionId: string;
    description: string;
    timestamp?: string;
  }): SimulationEvent {
    return this.recordEvent({
      actorId: data.actorId,
      timestamp: data.timestamp || new Date().toISOString(),
      type: "action_completed",
      data: { actionId: data.actionId, description: data.description },
    });
  }

  public getRecentEvents(count = 10): SimulationEvent[] {
    return this.events.slice(-count);
  }

  public getEventsForCharacter(actorId: string): SimulationEvent[] {
    return this.events.filter((e) => e.actorId === actorId);
  }

  public getAllEvents(): SimulationEvent[] {
    return [...this.events];
  }

  public clear(): void {
    this.events = [];
    this.nextId = 1;
  }
}

