import { redact } from "./redact.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  log(
    level: LogLevel,
    event: string,
    fields?: Readonly<Record<string, unknown>>
  ): void;
}

const weights: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export class JsonLogger implements Logger {
  public constructor(
    private readonly minimumLevel: LogLevel = "info",
    private readonly sink: (line: string) => void = console.log
  ) {}

  public log(
    level: LogLevel,
    event: string,
    fields: Readonly<Record<string, unknown>> = {}
  ): void {
    if (weights[level] < weights[this.minimumLevel]) return;
    this.sink(
      JSON.stringify(
        redact({ timestamp: new Date().toISOString(), level, event, ...fields })
      )
    );
  }
}
