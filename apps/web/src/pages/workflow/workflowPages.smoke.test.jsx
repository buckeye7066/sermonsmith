import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ThemeProvider from "../../theme/ThemeProvider.jsx";
import ReadScripture from "./ReadScripture.jsx";
import Study from "./Study.jsx";
import BuildMessage from "./BuildMessage.jsx";
import PlanSeries from "./PlanSeries.jsx";
import WorkflowLibrary from "./Library.jsx";
import Present from "./Present.jsx";

const workflowPages = [
  { name: "Read Scripture", Component: ReadScripture, expectedCopy: /read|scripture|bible/i },
  { name: "Study", Component: Study, expectedCopy: /study|understand|notes|meaning/i },
  { name: "Build Sermon or Lesson", Component: BuildMessage, expectedCopy: /build|sermon|lesson|message/i },
  { name: "Plan Series", Component: PlanSeries, expectedCopy: /plan|series|week/i },
  { name: "Library", Component: WorkflowLibrary, expectedCopy: /library|saved|draft|sermon|lesson/i },
  { name: "Present", Component: Present, expectedCopy: /present|teach|share|deliver/i },
];

afterEach(() => cleanup());

describe("workflow pages", () => {
  it.each(workflowPages)("renders a friendly, non-blank page for $name", ({ Component, expectedCopy }) => {
    const { container } = render(
      <ThemeProvider>
        <MemoryRouter>
          <Component />
        </MemoryRouter>
      </ThemeProvider>,
    );

    const text = container.textContent.replace(/\s+/g, " ").trim();

    expect(text.length).toBeGreaterThan(30);
    expect(text).toMatch(expectedCopy);
    expect(text).not.toMatch(/TypeError|ReferenceError|SyntaxError|stack trace|undefined|null|cannot read/i);
  });
});
