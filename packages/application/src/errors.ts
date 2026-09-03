export class InvalidChatRequestError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidChatRequestError";
  }
}

export class SessionNotFoundError extends Error {
  public constructor() {
    super("Session not found");
    this.name = "SessionNotFoundError";
  }
}

export class SessionBusyError extends Error {
  public constructor() {
    super("A chat turn is already active for this session");
    this.name = "SessionBusyError";
  }
}

export class ProviderUnavailableError extends Error {
  public constructor(providerId: string) {
    super(`Provider not registered: ${providerId}`);
    this.name = "ProviderUnavailableError";
  }
}

export class InputContextLimitError extends Error {
  public constructor() {
    super("Message exceeds the selected model context budget");
    this.name = "InputContextLimitError";
  }
}
