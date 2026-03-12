import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the path to the templates directory.
 * Works both in development (src/) and production (dist/).
 */
export function getTemplatesDir(): string {
  // From dist/index.js or src/utils/template.ts, go up to project root
  const root = path.resolve(__dirname, "..", "..");
  return path.join(root, "templates");
}

/**
 * Interpolate {{VAR}} placeholders in a string.
 */
export function interpolate(
  content: string,
  variables: Record<string, string>,
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

/**
 * Copy the template directory to the target, interpolating .template files.
 */
export async function copyTemplate(
  templateName: string,
  targetDir: string,
  variables: Record<string, string>,
): Promise<void> {
  const templateDir = path.join(getTemplatesDir(), templateName);

  if (!(await fs.pathExists(templateDir))) {
    throw new Error(`Template "${templateName}" not found at ${templateDir}`);
  }

  // Recursively walk and copy
  await copyDir(templateDir, targetDir, variables);
}

async function copyDir(
  src: string,
  dest: string,
  variables: Record<string, string>,
): Promise<void> {
  await fs.ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    let destName = entry.name;

    if (entry.isDirectory()) {
      await copyDir(srcPath, path.join(dest, destName), variables);
    } else if (entry.isFile()) {
      // Handle .template files: interpolate and strip the .template extension
      if (destName.endsWith(".template")) {
        destName = destName.replace(/\.template$/, "");
        const content = await fs.readFile(srcPath, "utf-8");
        const interpolated = interpolate(content, variables);
        await fs.writeFile(path.join(dest, destName), interpolated, "utf-8");
      } else {
        // Copy as-is
        await fs.copy(srcPath, path.join(dest, destName));
      }
    }
  }
}
