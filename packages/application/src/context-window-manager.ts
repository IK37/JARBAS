import type { ChatMessage } from "@jarvis/contracts";

export interface ContextSelection {
  readonly messages: readonly ChatMessage[];
  readonly estimatedTokens: number;
  readonly droppedMessages: number;
}

export class ContextWindowManager {
  public constructor(private readonly estimatedCharactersPerToken: number) {
    if (estimatedCharactersPerToken <= 0) {
      throw new Error("estimatedCharactersPerToken must be positive");
    }
  }

  public estimateMessageTokens(message: ChatMessage): number {
    const characters = Array.from(message.content).length;
    return Math.ceil(characters / this.estimatedCharactersPerToken) + 4;
  }

  public select(
    messages: readonly ChatMessage[],
    tokenBudget: number
  ): ContextSelection {
    if (!Number.isInteger(tokenBudget) || tokenBudget <= 0) {
      throw new Error("Context token budget must be a positive integer");
    }
    const latest = messages.at(-1);
    if (latest && this.estimateMessageTokens(latest) > tokenBudget) {
      return {
        messages: [],
        estimatedTokens: 0,
        droppedMessages: messages.length
      };
    }

    const selected: ChatMessage[] = [];
    let estimatedTokens = 0;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (!message) continue;
      const messageTokens = this.estimateMessageTokens(message);
      if (estimatedTokens + messageTokens > tokenBudget) break;
      selected.unshift(message);
      estimatedTokens += messageTokens;
    }

    while (selected[0]?.role === "assistant") {
      const removed = selected.shift();
      if (removed) estimatedTokens -= this.estimateMessageTokens(removed);
    }

    return {
      messages: selected,
      estimatedTokens,
      droppedMessages: messages.length - selected.length
    };
  }
}
