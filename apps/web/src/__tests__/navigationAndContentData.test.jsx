import { describe, expect, it } from "vitest";
import * as navModule from "../lib/navItems.js";
import * as assistantsModule from "../data/assistants.js";
import * as placeholdersModule from "../data/placeholders.js";

function exportedList(moduleExports, likelyNames) {
  for (const name of likelyNames) {
    if (Array.isArray(moduleExports[name])) return moduleExports[name];
  }

  if (Array.isArray(moduleExports.default)) return moduleExports.default;

  if (moduleExports.default && typeof moduleExports.default === "object") {
    return Object.values(moduleExports.default).filter((value) => value && typeof value === "object");
  }

  return Object.values(moduleExports).filter((value) => value && typeof value === "object" && !Array.isArray(value));
}

const navItems = exportedList(navModule, ["navItems", "primaryNavItems", "workflowNavItems"]);
const assistants = exportedList(assistantsModule, ["assistants", "assistantInfo", "assistantInfos"]);
const placeholders = exportedList(placeholdersModule, ["placeholders", "placeholderPages", "pages"]);

describe("ordinary-user navigation data", () => {
  it("contains the full ministry workflow with real routes and descriptions", () => {
    expect(navItems.length).toBeGreaterThan(0);

    const ordinaryItems = navItems.filter((item) => item.visibleToOrdinaryUser !== false);
    const labels = ordinaryItems.map((item) => item.label).join(" | ");

    expect(labels).toMatch(/Read Scripture/i);
    expect(labels).toMatch(/Study/i);
    expect(labels).toMatch(/Build/i);
    expect(labels).toMatch(/Plan Series/i);
    expect(labels).toMatch(/Library/i);
    expect(labels).toMatch(/Present/i);

    for (const item of ordinaryItems) {
      expect(item.label).toEqual(expect.any(String));
      expect(item.label.trim().length).toBeGreaterThan(1);
      expect(item.route).toEqual(expect.any(String));
      expect(item.route).toMatch(/^\//);
      expect(item.description).toEqual(expect.any(String));
      expect(item.description.trim().length).toBeGreaterThan(10);
    }
  });

  it("does not show developer or admin-only links to ordinary users", () => {
    const ordinaryItems = navItems.filter((item) => item.visibleToOrdinaryUser !== false);
    const ordinaryNavigationText = ordinaryItems
      .map((item) => `${item.id || ""} ${item.label || ""} ${item.route || ""}`)
      .join(" ");

    expect(ordinaryNavigationText).not.toMatch(/admin|developer|debug|internal|storybook|api/i);
  });
});

describe("assistant and placeholder copy", () => {
  it("describes Larry and Arlynn in one helpful sentence each", () => {
    expect(assistants.length).toBeGreaterThanOrEqual(2);

    const larry = assistants.find((assistant) => /larry/i.test(assistant.name || ""));
    const arlynn = assistants.find((assistant) => /arlynn/i.test(assistant.name || ""));

    expect(larry).toBeTruthy();
    expect(arlynn).toBeTruthy();

    expect(larry.oneLineDescription || larry.description || "").toMatch(/single|sermon|lesson|message|draft/i);
    expect(arlynn.oneLineDescription || arlynn.description || "").toMatch(/series|multi-week|weeks|plan/i);
  });

  it("gives unfinished areas friendly next steps instead of technical errors", () => {
    expect(placeholders.length).toBeGreaterThan(0);

    for (const page of placeholders) {
      const copy = `${page.title || ""} ${page.comingSoonMessage || ""} ${page.whatYouCanDoNow || ""}`;

      expect(copy.trim().length).toBeGreaterThan(30);
      expect(copy).toMatch(/coming|soon|will|can|start|try|use|go/i);
      expect(copy).not.toMatch(/TypeError|ReferenceError|stack trace|undefined|null|500|404/i);
    }
  });
});
