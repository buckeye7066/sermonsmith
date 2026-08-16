import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ThemeProvider from "../../../theme/ThemeProvider.jsx";
import ThemeToggle from "../ThemeToggle.jsx";

function savedThemeText() {
  const entries = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    entries.push(`${key}:${localStorage.getItem(key)}`);
  }

  return entries.join(" ");
}

function visibleThemeText() {
  return `${document.documentElement.className} ${document.body.className} ${screen.getByRole("button").textContent}`;
}

describe("theme toggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.body.className = "";
  });

  it("switches between light and dark and saves the choice", async () => {
    const { unmount } = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(`${savedThemeText()} ${visibleThemeText()}`).toMatch(/light|dark/i);
    });

    const savedAfterClick = savedThemeText();
    expect(savedAfterClick).toMatch(/light|dark/i);

    unmount();
    document.documentElement.className = "";
    document.body.className = "";

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(savedThemeText()).toBe(savedAfterClick);
      expect(`${savedThemeText()} ${visibleThemeText()}`).toMatch(/light|dark/i);
    });
  });
});
