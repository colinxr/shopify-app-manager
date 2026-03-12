import { execa, type Options as ExecaOptions } from "execa";
import { logger } from "./logger.js";

/**
 * Run a command with inherited stdio (user sees real-time output).
 */
export async function run(
  command: string,
  args: string[],
  options?: ExecaOptions,
): Promise<void> {
  await execa(command, args, {
    stdio: "inherit",
    ...options,
  });
}

/**
 * Run a command and capture its output silently.
 * Returns { stdout, stderr }.
 */
export async function runSilent(
  command: string,
  args: string[],
  options?: ExecaOptions,
): Promise<{ stdout: string; stderr: string }> {
  const result = await execa(command, args, {
    stdio: "pipe",
    ...options,
  });
  return { stdout: result.stdout as string, stderr: result.stderr as string };
}

/**
 * Check if a command exists on the system.
 */
export async function commandExists(command: string): Promise<boolean> {
  try {
    await execa("which", [command]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Require a command to be installed, exit with helpful message if not.
 */
export async function requireCommand(
  command: string,
  installHint?: string,
): Promise<void> {
  const exists = await commandExists(command);
  if (!exists) {
    logger.error(`Required command "${command}" not found.`);
    if (installHint) {
      logger.info(`Install it with: ${installHint}`);
    }
    process.exit(1);
  }
}
