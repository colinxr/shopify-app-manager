import { Command } from "commander";
import { input, confirm } from "@inquirer/prompts";
import path from "path";
import fs from "fs-extra";
import { logger } from "../utils/logger.js";
import { run, commandExists } from "../utils/exec.js";
import { writeConfig, isSamProject, type SamConfig } from "../utils/project.js";
import { getTemplatesDir } from "../utils/template.js";

const DEFAULT_TEMPLATE =
  "https://github.com/Shopify/shopify-app-template-react-router";

async function getProjectName(arg?: string): Promise<string> {
  return (
    arg ??
    input({
      message: "What is your project name?",
      validate: (value) => {
        if (!value.trim()) return "Project name is required";
        if (!/^[a-z0-9-]+$/.test(value))
          return "Use lowercase letters, numbers, and hyphens only";
        return true;
      },
    })
  );
}

async function resolveTargetDir(projectName: string): Promise<string> {
  const targetDir = path.resolve(process.cwd(), projectName);

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

  return targetDir;
}

async function getD1DatabaseName(projectName: string): Promise<string> {
  return input({
    message: "D1 database name:",
    default: `${projectName}-db`,
  });
}

async function checkShopifyCli(): Promise<void> {
  const hasShopifyCli = await commandExists("shopify");
  if (!hasShopifyCli) {
    logger.error(
      "Shopify CLI is required. Install with: npm install -g @shopify/cli",
    );
    process.exit(1);
  }
}

async function runShopifyInit(
  projectName: string,
  templateUrl: string,
): Promise<void> {
  logger.step("Running shopify app init (this will be interactive)...");
  await run("shopify", [
    "app",
    "init",
    "--template",
    templateUrl,
    "--name",
    projectName,
    "--path",
    process.cwd(),
  ]);
}

async function verifyProjectCreated(targetDir: string): Promise<void> {
  if (!(await fs.pathExists(targetDir))) {
    logger.error("Failed to create project directory.");
    process.exit(1);
  }
}

async function copyWorkerFiles(targetDir: string): Promise<string> {
  const samDir = path.join(targetDir, ".sam");
  const templatesWorkerDir = path.join(getTemplatesDir(), "default");
  await fs.copy(templatesWorkerDir, samDir);
  logger.success("Worker files copied to .sam/");
  return samDir;
}

async function writeSamConfig(
  targetDir: string,
  projectName: string,
  d1DatabaseName: string,
): Promise<void> {
  const config: SamConfig = {
    name: projectName,
    templateVersion: "0.1.0",
    d1DatabaseName,
    createdAt: new Date().toISOString(),
  };
  await writeConfig(targetDir, config);
  logger.success("Created sam.config.json");
}

async function installDependencies(
  targetDir: string,
  skip?: boolean,
): Promise<void> {
  if (skip) return;

  logger.step("Installing dependencies...");
  try {
    await run("npm", ["install"], { cwd: targetDir });
    logger.success("Dependencies installed.");
  } catch {
    logger.warn("npm install failed. You can run it manually later.");
  }
}

async function generatePrismaClient(
  targetDir: string,
  skip?: boolean,
): Promise<void> {
  if (skip) return;

  logger.step("Generating Prisma client...");
  try {
    await run("npx", ["prisma", "generate"], { cwd: targetDir });
    logger.success("Prisma client generated.");
  } catch {
    logger.warn("Prisma generate failed. You can run it manually later.");
  }
}

function printSuccessMessage(projectName: string): void {
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
}

export const initCommand = new Command("init")
  .description(
    "Scaffold a new Shopify app with React Router + Cloudflare Workers",
  )
  .argument("[project-name]", "Name of the project directory")
  .option("-t, --template <url>", "Template repository URL", DEFAULT_TEMPLATE)
  .option("--skip-install", "Skip npm install")
  .option("--skip-git", "Skip git initialization")
  .action(
    async (
      projectNameArg?: string,
      options?: {
        template?: string;
        skipInstall?: boolean;
        skipGit?: boolean;
      },
    ) => {
      logger.banner("Shopify App Manager - Project Setup");

      const projectName = await getProjectName(projectNameArg);
      const targetDir = await resolveTargetDir(projectName);
      const d1DatabaseName = await getD1DatabaseName(projectName);

      await checkShopifyCli();

      const templateUrl = options?.template || DEFAULT_TEMPLATE;
      await runShopifyInit(projectName, templateUrl);

      await verifyProjectCreated(targetDir);
      await copyWorkerFiles(targetDir);
      await writeSamConfig(targetDir, projectName, d1DatabaseName);

      await installDependencies(targetDir, options?.skipInstall);
      await generatePrismaClient(targetDir, options?.skipInstall);

      printSuccessMessage(projectName);
    },
  );
