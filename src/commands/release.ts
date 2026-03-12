import { Command } from "commander";
import { input, confirm } from "@inquirer/prompts";
import { logger } from "../utils/logger.js";
import { run, requireCommand } from "../utils/exec.js";
import { requireSamProject } from "../utils/project.js";

export const releaseCommand = new Command("release")
  .description("Create a new Shopify app version")
  .option("--message <message>", "Version message")
  .action(async (options: { message?: string }) => {
    const config = await requireSamProject();

    logger.step(`Creating a new release for "${config.name}"...`);

    await requireCommand("shopify", "npm install -g @shopify/cli");

    // Get version message
    const message =
      options.message ??
      (await input({
        message: "Version message (optional):",
        default: "",
      }));

    // Confirm
    const proceed = await confirm({
      message: "Create a new Shopify app version?",
      default: true,
    });
    if (!proceed) {
      logger.info("Release cancelled.");
      return;
    }

    // Create version
    logger.step("Creating Shopify app version...");
    try {
      const args = ["shopify", "app", "versions", "create"];
      if (message) {
        args.push("--message", message);
      }
      await run("npx", args);
      logger.success("New app version created!");
    } catch (error) {
      logger.error("Failed to create app version.");
      process.exit(1);
    }

    logger.blank();
    logger.info(
      "Visit your Shopify Partner Dashboard to review and submit the version.",
    );
  });
