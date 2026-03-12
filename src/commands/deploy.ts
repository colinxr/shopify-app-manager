import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import { logger } from "../utils/logger.js";
import { run, requireCommand } from "../utils/exec.js";
import { requireSamProject } from "../utils/project.js";

export const deployCommand = new Command("deploy")
  .description("Build and deploy to Cloudflare Workers")
  .option("--skip-build", "Skip the build step")
  .option("--dry-run", "Run wrangler deploy in dry-run mode")
  .option("-y, --yes", "Skip confirmation prompts")
  .action(
    async (options: {
      skipBuild?: boolean;
      dryRun?: boolean;
      yes?: boolean;
    }) => {
      const config = await requireSamProject();

      logger.step(`Deploying "${config.name}" to Cloudflare Workers...`);

      await requireCommand("wrangler", "npm install -g wrangler");

      // Confirm deployment
      if (!options.yes) {
        const proceed = await confirm({
          message: "Deploy to Cloudflare Workers?",
          default: true,
        });
        if (!proceed) {
          logger.info("Deployment cancelled.");
          return;
        }
      }

      // Build
      if (!options.skipBuild) {
        logger.step("Building for production...");
        try {
          await run("npm", ["run", "build:worker"]);
          logger.success("Build complete.");
        } catch (error) {
          logger.error("Build failed.");
          process.exit(1);
        }
      }

      // Deploy
      logger.step("Deploying with wrangler...");
      try {
        const args = ["wrangler", "deploy"];
        if (options.dryRun) {
          args.push("--dry-run");
        }
        await run("npx", args);
        logger.success("Deployment complete!");
      } catch (error) {
        logger.error("Deployment failed.");
        process.exit(1);
      }

      logger.blank();
      if (!options.dryRun) {
        logger.info(
          "Don't forget to run D1 migrations if you have pending schema changes:",
        );
        logger.step(
          `npx wrangler d1 execute ${config.d1DatabaseName ?? "your-db"} --remote --file=./prisma/migrations/latest.sql`,
        );
      }
    },
  );
