import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ThemeProvider from "../theme/ThemeProvider.jsx";
import Home from "../pages/Home.jsx";

function renderHome() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("Home experience", () => {
  it("welcomes a first-time user and makes the next actions obvious", () => {
    const { container } = renderHome();
    const text = container.textContent.replace(/\s+/g, " ");

    expect(text).toMatch(/SermonSmith/i);
    expect(text).toMatch(/sermon|lesson|Scripture|Bible/i);

    const controls = [...screen.queryAllByRole("link"), ...screen.queryAllByRole("button")].map((element) =>
      element.textContent.replace(/\s+/g, " ").trim(),
    );

    expect(controls.some((label) => /read/i.test(label))).toBe(true);
    expect(controls.some((label) => /stud/i.test(label))).toBe(true);
    expect(controls.some((label) => /build|message|sermon|lesson/i.test(label))).toBe(true);
  });

  it("plainly explains what Larry and Arlynn can do", () => {
    const { container } = renderHome();
    const text = container.textContent.replace(/\s+/g, " ");

    expect(text).toMatch(/Larry/i);
    expect(text).toMatch(/Arlynn/i);
    expect(text).toMatch(/Larry.*(single|sermon|lesson|message|draft)|((single|sermon|lesson|message|draft).*Larry)/i);
    expect(text).toMatch(/Arlynn.*(series|multi-week|weeks|plan)|((series|multi-week|weeks|plan).*Arlynn)/i);
  });
});
