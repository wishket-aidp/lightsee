import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LeftSidebar from "../LeftSidebar";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

const theme = {
  codeBg: "#f5f5f5",
  text: "#1a1a1a",
  link: "#0066cc",
  border: "#e0e0e0",
  blockquoteText: "#555555",
};

const defaultProps = {
  recentFiles: [] as string[],
  favoriteFolders: [] as string[],
  theme,
  onOpenFile: vi.fn(),
  onAddFolder: vi.fn(),
  onRemoveFolder: vi.fn(),
  onRemoveRecent: vi.fn(),
  cloudPaths: [] as string[],
  onCloudExpose: vi.fn(() => Promise.resolve()),
};

describe("LeftSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
  });

  it("renders Recent Files and Favorites section titles", () => {
    render(<LeftSidebar {...defaultProps} />);
    expect(screen.getByText("Recent Files")).toBeInTheDocument();
    expect(screen.getByText("Favorites")).toBeInTheDocument();
  });

  it("shows 'No recent files' when recentFiles is empty", () => {
    render(<LeftSidebar {...defaultProps} />);
    expect(screen.getByText("No recent files")).toBeInTheDocument();
  });

  it("renders recent file names", () => {
    const props = {
      ...defaultProps,
      recentFiles: ["/path/to/file1.md", "/path/to/file2.md"],
    };
    render(<LeftSidebar {...props} />);
    expect(screen.getByText("file1.md")).toBeInTheDocument();
    expect(screen.getByText("file2.md")).toBeInTheDocument();
  });

  it("calls onOpenFile when recent file is clicked", () => {
    const props = {
      ...defaultProps,
      recentFiles: ["/path/to/readme.md"],
    };
    render(<LeftSidebar {...props} />);
    fireEvent.click(screen.getByText("readme.md"));
    expect(props.onOpenFile).toHaveBeenCalledWith("/path/to/readme.md");
  });

  it("calls onRemoveRecent when remove button is clicked", () => {
    const props = {
      ...defaultProps,
      recentFiles: ["/path/to/readme.md"],
    };
    render(<LeftSidebar {...props} />);
    // Find the "x" button within the recent item
    const removeBtn = screen.getByText("x");
    fireEvent.click(removeBtn);
    expect(props.onRemoveRecent).toHaveBeenCalledWith("/path/to/readme.md");
    expect(props.onOpenFile).not.toHaveBeenCalled();
  });

  it("renders favorite folder names", () => {
    const props = {
      ...defaultProps,
      favoriteFolders: ["/Users/test/docs"],
    };
    render(<LeftSidebar {...props} />);
    expect(screen.getByText("docs")).toBeInTheDocument();
  });

  it("shows + Add Folder button", () => {
    render(<LeftSidebar {...defaultProps} />);
    expect(screen.getByText("+ Add Folder")).toBeInTheDocument();
  });

  it("calls onRemoveFolder when folder remove button is clicked", () => {
    const props = {
      ...defaultProps,
      favoriteFolders: ["/Users/test/docs"],
    };
    render(<LeftSidebar {...props} />);

    // The folder remove button contains "x"
    const folderRemoveBtn = document.querySelector(".folder-remove");
    expect(folderRemoveBtn).not.toBeNull();
    fireEvent.click(folderRemoveBtn!);
    expect(props.onRemoveFolder).toHaveBeenCalledWith("/Users/test/docs");
  });

  it("shows cloud indicator for shared folders", () => {
    const props = {
      ...defaultProps,
      favoriteFolders: ["/Users/test/docs"],
      cloudPaths: ["/Users/test/docs"],
    };
    render(<LeftSidebar {...props} />);
    const cloudIcon = screen.getByTitle("Cloud shared");
    expect(cloudIcon).toBeInTheDocument();
  });

  it("does not show cloud indicator for non-shared folders", () => {
    const props = {
      ...defaultProps,
      favoriteFolders: ["/Users/test/docs"],
      cloudPaths: [],
    };
    render(<LeftSidebar {...props} />);
    expect(screen.queryByTitle("Cloud shared")).not.toBeInTheDocument();
  });

  it("shows refresh and cloud action buttons for each folder", () => {
    const props = {
      ...defaultProps,
      favoriteFolders: ["/Users/test/docs"],
    };
    render(<LeftSidebar {...props} />);
    expect(screen.getByTitle("Refresh file list")).toBeInTheDocument();
    expect(screen.getByTitle("Share to cloud")).toBeInTheDocument();
  });

  it("shows 'Update cloud share' title for already-shared folders", () => {
    const props = {
      ...defaultProps,
      favoriteFolders: ["/Users/test/docs"],
      cloudPaths: ["/Users/test/docs"],
    };
    render(<LeftSidebar {...props} />);
    expect(screen.getByTitle("Update cloud share")).toBeInTheDocument();
  });

  it("toggles folder expansion on click", () => {
    const entries = [
      { name: "readme.md", path: "/Users/test/docs/readme.md", is_dir: false, children: [] },
    ];
    mockInvoke.mockResolvedValue(entries);

    const props = {
      ...defaultProps,
      favoriteFolders: ["/Users/test/docs"],
    };
    render(<LeftSidebar {...props} />);

    // Folder should be expanded by default (added to expandedFolders on mount)
    // Click to collapse
    fireEvent.click(screen.getByText("docs"));
    // Click again to expand
    fireEvent.click(screen.getByText("docs"));
  });
});
