import { Command } from "commander";
import { input, confirm } from "@inquirer/prompts";
import path from "path";
import fs from "fs-extra";
import { logger } from "../utils/logger.js";
import { run } from "../utils/exec.js";
import { writeConfig, isSamProject, type SamConfig } from "../utils/project.js";

const TEMPLATE_REPO = "https://github.com/Shopify/shopify-app-template-react-router";

const WORKER_FILES = [
  "app/worker-session-storage.ts",
  "app/shopify.server.worker.ts",
  "app/entry.worker.ts",
  "app/entry.server.worker.tsx",
  "vite.worker.config.ts",
];

export const initCommand = new Command("init")
  .description("Scaffold a new Shopify app with React Router + Cloudflare Workers")
  .argument("[project-name]", "Name of the project directory")
  .option("--skip-install", "Skip npm install")
  .option("--skip-git", "Skip git initialization")
  .action(async (projectNameArg?: string, options?: { skipInstall?: boolean; skipGit?: boolean }) => {
    logger.banner("Shopify App Manager - Project Setup");

    // 1. Get project name
    const projectName =
      projectNameArg ??
      (await input({
        message: "What is your project name?",
        validate: (value) => {
          if (!value.trim()) return "Project name is required";
          if (!/^[a-z0-9-]+$/.test(value))
            return "Use lowercase letters, numbers, and hyphens only";
          return true;
        },
      }));

    const targetDir = path.resolve(process.cwd(), projectName);

    // 2. Check if directory exists
    if (await fs.pathExists(targetDir)) {
      if (await isSamProject(targetDir)) {
        logger.error(`Directory "${projectName}" is already a sam project.`);
        process.exit(1);
      }

      const files = await fs.readdir(targetDir);
      if (files.length > 0) {
        const proceed = await confirm({
          message: `Directory "${projectName}" is not empty. Continue anyway?`,
          default: false,
        });
        if (!proceed) {
          logger.info("Aborted.");
          process.exit(0);
        }
      }
    }

    // 3. Get app details
    const appName = await input({
      message: "What is your Shopify app name? (display name)",
      default: projectName,
    });

    const d1DatabaseName = await input({
      message: "D1 database name:",
      default: `${projectName}-db`,
    });

    // 4. Clone template repo
    logger.step("Cloning template repository...");

    const tempDir = path.resolve(process.cwd(), `.sam-temp-${Date.now()}`);
    try {
      await run("git", ["clone", "--depth", "1", TEMPLATE_REPO, tempDir], {
        stdio: "pipe",
      });
    } catch (error) {
      logger.error("Failed to clone template repository.");
      process.exit(1);
    }

    // Move contents from temp dir to target dir
    const tempContents = await fs.readdir(tempDir);
    for (const item of tempContents) {
      await fs.move(path.join(tempDir, item), path.join(targetDir, item));
    }
    await fs.remove(tempDir);
    logger.success("Template cloned.");

    // 5. Move worker files to .sam directory
    logger.step("Moving worker files to .sam directory...");
    const samDir = path.join(targetDir, ".sam");
    await fs.ensureDir(samDir);

    for (const workerFile of WORKER_FILES) {
      const srcPath = path.join(targetDir, workerFile);
      if (await fs.pathExists(srcPath)) {
        const destPath = path.join(samDir, path.basename(workerFile));
        await fs.move(srcPath, destPath);
      }
    }
    logger.success("Worker files moved to .sam/");

    // 6. Write sam config
    const config: SamConfig = {
      name: projectName,
      templateVersion: "0.1.0",
      d1DatabaseName,
      createdAt: new Date().toISOString(),
    };
    await writeConfig(targetDir, config);
    logger.success("Created sam.config.json");

    // 7. Install dependencies
    if (!options?.skipInstall) {
      logger.step("Installing dependencies...");
      try {
        await run("npm", ["install"], { cwd: targetDir });
        logger.success("Dependencies installed.");
      } catch (error) {
        logger.warn("npm install failed. You can run it manually later.");
      }
    }

    // 8. Generate Prisma client
    if (!options?.skipInstall) {
      logger.step("Generating Prisma client...");
      try {
        await run("npx", ["prisma", "generate"], { cwd: targetDir });
        logger.success("Prisma client generated.");
      } catch (error) {
        logger.warn("Prisma generate failed. You can run it manually later.");
      }
    }

    // 9. Initialize git
    if (!options?.skipGit) {
      logger.step("Initializing git repository...");
      try {
        await run("git", ["init"], { cwd: targetDir });
        await run("git", ["add", "."], { cwd: targetDir });
        await run("git", ["commit", "-m", "Initial commit from sam init"], {
          cwd: targetDir,
        });
        logger.success("Git repository initialized.");
      } catch (error) {
        logger.warn("Git initialization failed. You can do it manually.");
      }
    }

    // 10. Print next steps
    logger.blank();
    logger.banner("Project created successfully!");
    logger.info("Next steps:");
    logger.blank();
    logger.step(`cd ${projectName}`);
    logger.step("Copy .env.example to .env and fill in your Shopify credentials");
    logger.step("Run: sam dev");
    logger.blank();
    logger.info("Other commands:");
    logger.step("sam deploy    - Deploy to Cloudflare Workers");
    logger.step("sam release   - Create a new Shopify app version");
    logger.blank();
  });
