import { EventEmitter } from "node:events";

export type RuntimeLogEvent = {
  ts: string;
  level: "info" | "stderr";
  message: string;
};

export class LogStreamService {
  private readonly emitter = new EventEmitter();
  private readonly history: RuntimeLogEvent[] = [];
  private readonly maxHistory: number;

  constructor(maxHistory = 500) {
    this.maxHistory = maxHistory;
  }

  publish(event: RuntimeLogEvent): void {
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    this.emitter.emit("event", event);
  }

  getHistory(limit = 200): RuntimeLogEvent[] {
    return this.history.slice(-Math.max(1, limit));
  }

  subscribe(listener: (event: RuntimeLogEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }
}
