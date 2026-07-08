import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import manifest from "@/app/manifest";

const root = process.cwd();
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

/**
 * Public branding guard. The user-facing product name is "Open Avocado".
 * The legacy "AvocadoCore" name must not appear on any public surface, while
 * the AVOCADOCORE_ environment-variable prefix (backward compatibility) may.
 */
describe("public branding", () => {
  it("PWA manifest uses the Open Avocado name", () => {
    const m = manifest();
    expect(m.name).toContain("Open Avocado");
    expect(m.short_name).toBe("Open Avocado");
    expect(JSON.stringify(m)).not.toMatch(/AvocadoCore/);
  });

  it("root layout metadata title is Open Avocado", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toMatch(/title:\s*"Open Avocado/);
    expect(layout).not.toMatch(/AvocadoCore/);
  });

  it("login and register pages show Open Avocado", () => {
    for (const p of ["src/app/login/page.tsx", "src/app/register/page.tsx"]) {
      const src = read(p);
      expect(src).toContain("Open Avocado");
      expect(src).not.toMatch(/AvocadoCore/);
    }
  });

  it("package name is openavocado", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.name).toBe("openavocado");
  });

  it("no user-facing component text says AvocadoCore", () => {
    // The wordmark, logo, and widget host error copy must be rebranded.
    for (const p of ["src/components/Logo.tsx", "src/components/lesson/widgets/WidgetHost.tsx"]) {
      expect(read(p)).not.toMatch(/AvocadoCore/);
    }
  });
});
