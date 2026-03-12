import fs from "fs-extra";
import path from "path";

const CONFIG_FILE = "sam.config.json";

export interface SamConfig {
  name: string;
  templateVersion: string;
  d1DatabaseName?: string;
  d1DatabaseId?: string;
  createdAt: string;
}

/**
 * Check if the current directory (or a given directory) is a sam-managed project.
 */
export async function isSamProject(dir?: string): Promise<boolean> {
  const configPath = path.join(dir ?? process.cwd(), CONFIG_FILE);
  return fs.pathExists(configPath);
}

/**
 * Read the sam.config.json from the current directory.
 */
export async function readConfig(dir?: string): Promise<SamConfig> {
  const configPath = path.join(dir ?? process.cwd(), CONFIG_FILE);

  if (!(await fs.pathExists(configPath))) {
    throw new Error(
      `Not a sam project. Run "sam init" first, or navigate to a sam project directory.`,
    );
  }

  return fs.readJson(configPath);
}

/**
 * Write a sam.config.json to the given directory.
 */
export async function writeConfig(
  dir: string,
  config: SamConfig,
): Promise<void> {
  const configPath = path.join(dir, CONFIG_FILE);
  await fs.writeJson(configPath, config, { spaces: 2 });
}

/**
 * Ensure we're in a sam project, exit with error if not.
 */
export async function requireSamProject(dir?: string): Promise<SamConfig> {
  try {
    return await readConfig(dir);
  } catch {
    console.error(
      'Error: Not a sam project. Run "sam init" first, or navigate to a sam project directory.',
    );
    process.exit(1);
  }
}
