import { Command } from "commander";
import { logger } from "../utils/logger.js";
import { run, requireCommand } from "../utils/exec.js";
import { requireSamProject } from "../utils/project.js";

export const devCommand = new Command("dev")
  .description("Start the Shopify app development server")
  .option("--reset", "Reset Shopify CLI config and re-select store/app")
  .action(async (options: { reset?: boolean }) => {
    const config = await requireSamProject();

    logger.step(`Starting dev server for "${config.name}"...`);
    logger.blank();

    await requireCommand(
      "shopify",
      "npm install -g @shopify/cli",
    );

    const args = ["app", "dev"];

    if (options.reset) {
      args.push("--reset");
    }

    try {
      await run("npx", ["shopify", ...args]);
    } catch (error) {
      // shopify app dev exits with non-zero on Ctrl+C, which is normal
      // Only log if it's an actual error
      if (error instanceof Error && !error.message.includes("SIGINT")) {
        logger.error("Dev server exited with an error.");
        process.exit(1);
      }
    }
  });
