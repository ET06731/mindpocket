import { z } from "zod"

export const BOOKMARK_TYPES = [
  "link",
  "article",
  "video",
  "image",
  "document",
  "audio",
  "spreadsheet",
  "other",
] as const
export type BookmarkType = (typeof BOOKMARK_TYPES)[number]

export const SOURCE_TYPES = ["url", "file", "extension"] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export const CLIENT_SOURCES = [
  "web",
  "mobile",
  "extension",
  "bilibili_sync",
  "twitter_sync",
] as const
export type ClientSource = (typeof CLIENT_SOURCES)[number]

export const INGEST_STATUSES = ["pending", "processing", "completed", "failed"] as const
export type IngestStatus = (typeof INGEST_STATUSES)[number]

export const ingestUrlSchema = z.object({
  url: z.string().url(),
  folderId: z.string().optional(),
  title: z.string().optional(),
  clientSource: z.enum(CLIENT_SOURCES),
})

export const ingestExtensionSchema = z.object({
  url: z.string().url(),
  html: z.string().min(1).optional(),
  title: z.string().optional(),
  folderId: z.string().optional(),
  clientSource: z.enum(CLIENT_SOURCES),
})

export const EXTENSION_TYPE_MAP: Record<string, BookmarkType> = {
  ".pdf": "document",
  ".docx": "document",
  ".doc": "document",
  ".md": "document",
  ".markdown": "document",
  ".xlsx": "spreadsheet",
  ".xls": "spreadsheet",
  ".csv": "spreadsheet",
  ".mp3": "audio",
  ".wav": "audio",
  ".mp4": "video",
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".gif": "image",
  ".webp": "image",
  ".html": "article",
  ".htm": "article",
  ".xml": "article",
  ".ipynb": "document",
  ".zip": "other",
}

export const URL_TYPE_PATTERNS: Array<{ pattern: RegExp; type: BookmarkType }> = [
  { pattern: /youtube\.com|youtu\.be/, type: "video" },
  { pattern: /bilibili\.com/, type: "video" },
  { pattern: /mp\.weixin\.qq\.com/, type: "article" },
  { pattern: /\.(pdf)$/i, type: "document" },
  { pattern: /\.(mp3|wav)$/i, type: "audio" },
  { pattern: /\.(jpg|jpeg|png|gif|webp)$/i, type: "image" },
]

export const PLATFORM_PATTERNS: Array<{ pattern: RegExp; platform: string }> = [
  { pattern: /mp\.weixin\.qq\.com/, platform: "wechat" },
  { pattern: /youtube\.com|youtu\.be/, platform: "youtube" },
  { pattern: /github\.com/, platform: "github" },
  { pattern: /zhihu\.com/, platform: "zhihu" },
  { pattern: /bilibili\.com/, platform: "bilibili" },
  { pattern: /xiaohongshu\.com|xhslink\.com/, platform: "xiaohongshu" },
  { pattern: /twitter\.com|x\.com/, platform: "twitter" },
  { pattern: /medium\.com/, platform: "medium" },
  { pattern: /reddit\.com/, platform: "reddit" },
  { pattern: /stackoverflow\.com/, platform: "stackoverflow" },
  { pattern: /juejin\.cn/, platform: "juejin" },
  { pattern: /jianshu\.com/, platform: "jianshu" },
  { pattern: /notion\.so/, platform: "notion" },
  { pattern: /arxiv\.org/, platform: "arxiv" },
]

export function inferPlatform(url: string): string | null {
  for (const { pattern, platform } of PLATFORM_PATTERNS) {
    if (pattern.test(url)) {
      return platform
    }
  }
  return null
}

export interface IngestResult {
  bookmarkId: string
  title: string
  markdown: string | null
  type: BookmarkType
  status: IngestStatus
  error?: string
}
