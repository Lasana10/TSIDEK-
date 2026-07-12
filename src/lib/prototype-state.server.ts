import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type PrototypeCollections = Record<string, unknown>;

const stateFilePath = path.join(process.cwd(), ".runtime", "tsidkenu-prototype-backend.json");

async function readCollections(): Promise<PrototypeCollections> {
  try {
    const raw = await readFile(stateFilePath, "utf8");
    const parsed = JSON.parse(raw) as PrototypeCollections;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeCollections(state: PrototypeCollections) {
  await mkdir(path.dirname(stateFilePath), { recursive: true });
  await writeFile(stateFilePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function readPrototypeCollection<T>(key: string, fallback: T): Promise<T> {
  const state = await readCollections();
  const value = state[key];
  return (value as T | undefined) ?? fallback;
}

export async function writePrototypeCollection<T>(key: string, value: T) {
  const state = await readCollections();
  state[key] = value;
  await writeCollections(state);
  return value;
}
