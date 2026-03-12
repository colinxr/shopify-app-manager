import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { devCommand } from "./commands/dev.js";
import { deployCommand } from "./commands/deploy.js";
import { releaseCommand } from "./commands/release.js";

const program = new Command();

program
  .name("sam")
  .description(
    "Shopify App Manager - Scaffold and manage Shopify apps with React Router + Cloudflare Workers",
  )
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(devCommand);
program.addCommand(deployCommand);
program.addCommand(releaseCommand);

program.parse();
