import { promises as fs } from "fs";
import path from "path";

interface ActiveConversationState {
  activeConversationId?: string;
}

const STATE_FILENAME = "state.json";

function stateFilePath(codexHome: string): string {
  return path.join(codexHome, STATE_FILENAME);
}

async function safeReadFile(file: string): Promise<string | undefined> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return undefined;
    }
    console.warn("Failed to read CLI state:", error);
    return undefined;
  }
}

export async function readActiveConversationId(
  codexHome: string,
): Promise<string | undefined> {
  const file = stateFilePath(codexHome);
  const contents = await safeReadFile(file);
  if (!contents) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(contents) as ActiveConversationState;
    if (
      parsed &&
      typeof parsed.activeConversationId === "string" &&
      parsed.activeConversationId.length > 0
    ) {
      return parsed.activeConversationId;
    }
  } catch (error) {
    console.warn("Failed to parse CLI state:", error);
  }
  return undefined;
}

export async function writeActiveConversationId(
  codexHome: string,
  conversationId: string,
): Promise<void> {
  const file = stateFilePath(codexHome);
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const payload: ActiveConversationState = {
      activeConversationId: conversationId,
    };
    await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  } catch (error) {
    console.warn("Failed to write CLI state:", error);
  }
}

export async function clearActiveConversationId(
  codexHome: string,
): Promise<void> {
  const file = stateFilePath(codexHome);
  try {
    await fs.unlink(file);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn("Failed to clear CLI state:", error);
    }
  }
}
