export interface Share {
  id: string;
  slug: string;
  title: string;
  type: "file" | "folder";
  theme: string;
  created_at: string;
  updated_at: string;
}

export interface ShareFile {
  id: string;
  share_id: string;
  path: string;
  storage_path: string;
  size_bytes: number;
}

export interface ThemeColors {
  bg: string;
  text: string;
  heading: string;
  link: string;
  codeBg: string;
  border: string;
  blockquoteBorder: string;
  blockquoteText: string;
}
