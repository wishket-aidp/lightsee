import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import App from "../App";
import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";

const mockInvoke = vi.mocked(invoke);
const mockLoad = vi.mocked(load);

function createMockStore(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn((key: string) => Promise.resolve(overrides[key] ?? null)),
    set: vi.fn(() => Promise.resolve()),
    save: vi.fn(() => Promise.resolve()),
  };
}

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
    mockLoad.mockResolvedValue(createMockStore() as ReturnType<typeof createMockStore>);
  });

  it("renders empty state when no tabs are open", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText("Drop a markdown file here")).toBeInTheDocument();
  });

  it("shows Open File button", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText("Open File")).toBeInTheDocument();
  });

  it("shows Theme button", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText("Theme")).toBeInTheDocument();
  });

  it("shows Cloud button", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText("Cloud")).toBeInTheDocument();
  });

  it("shows font size controls", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText("A-")).toBeInTheDocument();
    expect(screen.getByText("A+")).toBeInTheDocument();
    expect(screen.getByText("16px")).toBeInTheDocument();
  });

  it("increases font size when A+ is clicked", async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByText("A+"));
    expect(screen.getByText("18px")).toBeInTheDocument();
  });

  it("decreases font size when A- is clicked", async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByText("A-"));
    expect(screen.getByText("14px")).toBeInTheDocument();
  });

  it("does not go below 10px font size", async () => {
    await act(async () => {
      render(<App />);
    });
    // Click A- many times to go below minimum
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByText("A-"));
    }
    expect(screen.getByText("10px")).toBeInTheDocument();
  });

  it("does not go above 32px font size", async () => {
    await act(async () => {
      render(<App />);
    });
    for (let i = 0; i < 20; i++) {
      fireEvent.click(screen.getByText("A+"));
    }
    expect(screen.getByText("32px")).toBeInTheDocument();
  });

  it("toggles theme panel when Theme button is clicked", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.queryByText("Light")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Theme"));
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("Sepia")).toBeInTheDocument();
    expect(screen.getByText("Nord")).toBeInTheDocument();
  });

  it("shows all 17 theme chips when panel is open", async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByText("Theme"));
    const themePanel = document.querySelector(".theme-panel");
    expect(themePanel).not.toBeNull();
    const chips = themePanel!.querySelectorAll(".theme-chip");
    expect(chips).toHaveLength(17);
  });

  it("closes theme panel when a theme is selected", async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByText("Theme"));
    expect(screen.getByText("Dark")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Dark"));
    // Theme panel should be closed
    expect(screen.queryByText("Solarized")).not.toBeInTheDocument();
  });

  it("shows sidebar toggle buttons", async () => {
    await act(async () => {
      render(<App />);
    });
    const toggleButtons = screen.getAllByTitle(/Toggle.*sidebar/);
    expect(toggleButtons).toHaveLength(2);
  });

  it("toggles left sidebar visibility", async () => {
    await act(async () => {
      render(<App />);
    });
    const leftToggle = screen.getByTitle("Toggle left sidebar");
    // Left sidebar is open by default - should show sidebar content
    expect(document.querySelector(".sidebar-left")).toBeInTheDocument();

    fireEvent.click(leftToggle);
    expect(document.querySelector(".sidebar-left")).not.toBeInTheDocument();

    fireEvent.click(leftToggle);
    expect(document.querySelector(".sidebar-left")).toBeInTheDocument();
  });

  it("toggles right sidebar visibility", async () => {
    await act(async () => {
      render(<App />);
    });
    const rightToggle = screen.getByTitle("Toggle right sidebar");
    expect(document.querySelector(".sidebar-right")).toBeInTheDocument();

    fireEvent.click(rightToggle);
    expect(document.querySelector(".sidebar-right")).not.toBeInTheDocument();
  });

  it("shows keyboard shortcut hint in empty state", async () => {
    await act(async () => {
      render(<App />);
    });
    // Should show either ⌘T or Ctrl+T depending on platform
    const emptyState = document.querySelector(".empty-state");
    expect(emptyState).not.toBeNull();
    expect(emptyState!.textContent).toMatch(/⌘T|Ctrl\+T/);
  });

  it("loads settings from store on mount", async () => {
    const store = createMockStore({ theme: "dark", fontSize: 20 });
    mockLoad.mockResolvedValue(store as ReturnType<typeof createMockStore>);

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      expect(store.get).toHaveBeenCalledWith("theme");
      expect(store.get).toHaveBeenCalledWith("fontSize");
      expect(store.get).toHaveBeenCalledWith("recentFiles");
    });
  });

  it("restores saved theme from store", async () => {
    const store = createMockStore({ theme: "dark" });
    mockLoad.mockResolvedValue(store as ReturnType<typeof createMockStore>);

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      const app = document.querySelector(".app");
      expect(app).toHaveStyle({ backgroundColor: "#1e1e1e" });
    });
  });
});
