import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RightSidebar from "../RightSidebar";
import type { Heading } from "../RightSidebar";
import { createRef } from "react";

const theme = {
  codeBg: "#f5f5f5",
  text: "#1a1a1a",
  link: "#0066cc",
  border: "#e0e0e0",
};

const sampleHeadings: Heading[] = [
  { id: "intro", text: "Introduction", level: 1 },
  { id: "setup", text: "Setup", level: 2 },
  { id: "details", text: "Details", level: 3 },
  { id: "advanced", text: "Advanced", level: 2 },
];

describe("RightSidebar", () => {
  it("renders 'Contents' title", () => {
    const ref = createRef<HTMLDivElement>();
    render(<RightSidebar headings={sampleHeadings} theme={theme} contentRef={ref} />);
    expect(screen.getByText("Contents")).toBeInTheDocument();
  });

  it("renders all heading texts", () => {
    const ref = createRef<HTMLDivElement>();
    render(<RightSidebar headings={sampleHeadings} theme={theme} contentRef={ref} />);
    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Setup")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toBeInTheDocument();
  });

  it("shows 'No headings' when headings array is empty", () => {
    const ref = createRef<HTMLDivElement>();
    render(<RightSidebar headings={[]} theme={theme} contentRef={ref} />);
    expect(screen.getByText("No headings")).toBeInTheDocument();
  });

  it("renders heading items as buttons", () => {
    const ref = createRef<HTMLDivElement>();
    render(<RightSidebar headings={sampleHeadings} theme={theme} contentRef={ref} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
  });

  it("applies correct indentation — deeper levels have more padding", () => {
    const ref = createRef<HTMLDivElement>();
    render(<RightSidebar headings={sampleHeadings} theme={theme} contentRef={ref} />);

    const h1Button = screen.getByText("Introduction");
    const h2Button = screen.getByText("Setup");
    const h3Button = screen.getByText("Details");

    const h1Padding = parseInt(h1Button.style.paddingLeft, 10);
    const h2Padding = parseInt(h2Button.style.paddingLeft, 10);
    const h3Padding = parseInt(h3Button.style.paddingLeft, 10);

    // h1 < h2 < h3 in padding
    expect(h1Padding).toBeLessThan(h2Padding);
    expect(h2Padding).toBeLessThan(h3Padding);
  });

  it("uses relative indentation based on minimum level", () => {
    // If all headings start at h2, h2 should have 12px base padding
    const ref = createRef<HTMLDivElement>();
    const h2Only: Heading[] = [
      { id: "a", text: "Section A", level: 2 },
      { id: "b", text: "Subsection B", level: 3 },
    ];
    render(<RightSidebar headings={h2Only} theme={theme} contentRef={ref} />);

    const h2 = screen.getByText("Section A");
    const h3 = screen.getByText("Subsection B");

    // minLevel = 2, so h2 padding = 12 + (2-2)*14 = 12
    expect(h2.style.paddingLeft).toBe("12px");
    // h3 padding = 12 + (3-2)*14 = 26
    expect(h3.style.paddingLeft).toBe("26px");
  });

  it("sets title attribute on each heading button", () => {
    const ref = createRef<HTMLDivElement>();
    render(<RightSidebar headings={sampleHeadings} theme={theme} contentRef={ref} />);

    expect(screen.getByTitle("Introduction")).toBeInTheDocument();
    expect(screen.getByTitle("Setup")).toBeInTheDocument();
  });

  it("clicking heading button triggers scrollToHeading", () => {
    const container = document.createElement("div");
    const mockEl = document.createElement("h2");
    mockEl.id = "setup";
    mockEl.scrollIntoView = vi.fn();
    container.appendChild(mockEl);

    const ref = { current: container };
    render(<RightSidebar headings={sampleHeadings} theme={theme} contentRef={ref} />);

    fireEvent.click(screen.getByText("Setup"));
    expect(mockEl.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });
});
