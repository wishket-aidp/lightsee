import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CloudSharePanel from "../CloudSharePanel";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

const theme = {
  bg: "#ffffff",
  text: "#1a1a1a",
  heading: "#111111",
  link: "#0066cc",
  codeBg: "#f5f5f5",
  border: "#e0e0e0",
  blockquoteBorder: "#d0d0d0",
  blockquoteText: "#555555",
};

describe("CloudSharePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Share File and Share Folder buttons", async () => {
    mockInvoke.mockResolvedValue([]);
    render(<CloudSharePanel theme={theme} activeFilePath="/test.md" themeName="light" />);
    expect(screen.getByText("Share File")).toBeInTheDocument();
    expect(screen.getByText("Share Folder")).toBeInTheDocument();
  });

  it("renders Refresh button after loading completes", async () => {
    mockInvoke.mockResolvedValue([]);
    render(<CloudSharePanel theme={theme} activeFilePath="/test.md" themeName="light" />);
    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });
  });

  it("disables Share File button when no active file", async () => {
    mockInvoke.mockResolvedValue([]);
    render(<CloudSharePanel theme={theme} activeFilePath={null} themeName="light" />);
    const shareFileBtn = screen.getByText("Share File");
    expect(shareFileBtn).toBeDisabled();
  });

  it("enables Share File button when active file exists", async () => {
    mockInvoke.mockResolvedValue([]);
    render(<CloudSharePanel theme={theme} activeFilePath="/test.md" themeName="light" />);
    const shareFileBtn = screen.getByText("Share File");
    expect(shareFileBtn).not.toBeDisabled();
  });

  it("shows hint when no active file", async () => {
    mockInvoke.mockResolvedValue([]);
    render(<CloudSharePanel theme={theme} activeFilePath={null} themeName="light" />);
    expect(screen.getByText("Open a file to share it")).toBeInTheDocument();
  });

  it("shows 'No cloud shares yet' when list is empty", async () => {
    mockInvoke.mockResolvedValue([]);
    render(<CloudSharePanel theme={theme} activeFilePath="/test.md" themeName="light" />);
    await waitFor(() => {
      expect(screen.getByText("No cloud shares yet.")).toBeInTheDocument();
    });
  });

  it("renders share list with titles and URLs", async () => {
    const shares = [
      {
        slug: "abc123",
        title: "My Document",
        share_type: "file",
        local_path: "/path/to/doc.md",
        url: "https://viewer.ai-delivery.work/s/abc123",
        updated_at: "2024-01-15T10:30:00Z",
      },
    ];
    mockInvoke.mockResolvedValue(shares);
    render(<CloudSharePanel theme={theme} activeFilePath="/test.md" themeName="light" />);

    await waitFor(() => {
      expect(screen.getByText("My Document")).toBeInTheDocument();
      expect(screen.getByText("file")).toBeInTheDocument();
    });
  });

  it("shows Copy URL and Delete buttons for each share", async () => {
    const shares = [
      {
        slug: "abc123",
        title: "Doc",
        share_type: "file",
        local_path: "/doc.md",
        url: "https://viewer.ai-delivery.work/s/abc123",
        updated_at: "2024-01-15T10:30:00Z",
      },
    ];
    mockInvoke.mockResolvedValue(shares);
    render(<CloudSharePanel theme={theme} activeFilePath="/test.md" themeName="light" />);

    await waitFor(() => {
      expect(screen.getByText("Copy URL")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });
  });

  it("calls cloud_remove when Delete is clicked", async () => {
    const shares = [
      {
        slug: "abc123",
        title: "Doc",
        share_type: "file",
        local_path: "/doc.md",
        url: "https://viewer.ai-delivery.work/s/abc123",
        updated_at: "2024-01-15T10:30:00Z",
      },
    ];
    // First call returns shares, second (delete) returns void, third (refresh) returns empty
    mockInvoke
      .mockResolvedValueOnce(shares) // cloud_list
      .mockResolvedValueOnce(undefined) // cloud_remove
      .mockResolvedValueOnce([]); // cloud_list refresh

    render(<CloudSharePanel theme={theme} activeFilePath="/test.md" themeName="light" />);

    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("cloud_remove", { slug: "abc123" });
    });
  });

  it("copies URL to clipboard when Copy URL is clicked", async () => {
    const shares = [
      {
        slug: "abc123",
        title: "Doc",
        share_type: "file",
        local_path: "/doc.md",
        url: "https://viewer.ai-delivery.work/s/abc123",
        updated_at: "2024-01-15T10:30:00Z",
      },
    ];
    mockInvoke.mockResolvedValue(shares);

    render(<CloudSharePanel theme={theme} activeFilePath="/test.md" themeName="light" />);

    await waitFor(() => {
      expect(screen.getByText("Copy URL")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Copy URL"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://viewer.ai-delivery.work/s/abc123"
    );
  });

  it("shows 'Copied!' after clicking Copy URL", async () => {
    const shares = [
      {
        slug: "abc123",
        title: "Doc",
        share_type: "file",
        local_path: "/doc.md",
        url: "https://viewer.ai-delivery.work/s/abc123",
        updated_at: "2024-01-15T10:30:00Z",
      },
    ];
    mockInvoke.mockResolvedValue(shares);

    render(<CloudSharePanel theme={theme} activeFilePath="/test.md" themeName="light" />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("Copy URL"));
    });
    expect(screen.getByText("Copied!")).toBeInTheDocument();
  });

  it("shows error message on fetch failure", async () => {
    mockInvoke.mockRejectedValue("Network error");
    render(<CloudSharePanel theme={theme} activeFilePath="/test.md" themeName="light" />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("renders table headers", async () => {
    const shares = [
      {
        slug: "x",
        title: "T",
        share_type: "file",
        local_path: "/f.md",
        url: "https://example.com",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ];
    mockInvoke.mockResolvedValue(shares);
    render(<CloudSharePanel theme={theme} activeFilePath="/test.md" themeName="light" />);

    await waitFor(() => {
      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Type")).toBeInTheDocument();
      expect(screen.getByText("Path")).toBeInTheDocument();
      expect(screen.getByText("URL")).toBeInTheDocument();
      expect(screen.getByText("Updated")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });
  });
});
