"use client"

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileUp,
  Globe,
  List,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { BilibiliIcon, hasPlatformIcon, PlatformIcon } from "@/components/icons/platform-icons"
import { BilibiliSyncDialog } from "@/components/settings/bilibili-sync-dialog"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"

interface HistoryItem {
  id: string
  title: string
  type: string
  sourceType: string | null
  clientSource: string | null
  ingestStatus: string
  ingestError: string | null
  url: string | null
  platform: string | null
  createdAt: string
}

type StatusFilter = "all" | "pending" | "processing" | "completed" | "failed"
const MAX_URL_PREVIEW_LENGTH = 90

function getSourceLabel(item: HistoryItem, t: ReturnType<typeof useT>) {
  switch (item.clientSource) {
    case "web":
      return t.ingest.clientWeb
    case "mobile":
      return t.ingest.clientMobile
    case "extension":
      return t.ingest.clientExtension
    default:
      return t.ingest.sourceUnknown
  }
}

interface FolderInfo {
  id: string
  name: string
  emoji: string
}

export default function IngestPage() {
  const t = useT()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [folders, setFolders] = useState<FolderInfo[]>([])
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchHistory = useCallback(async (filter: StatusFilter) => {
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (filter !== "all") {
        params.set("status", filter)
      }
      const res = await fetch(`/api/ingest/history?${params}`)
      if (res.ok) {
        const data = await res.json()
        setHistory(data.items)
      }
    } catch {
      // silently fail
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory(statusFilter)
  }, [fetchHistory, statusFilter])

  useEffect(() => {
    fetch("/api/folders")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.folders) {
          setFolders(data.folders)
        }
      })
      .catch(() => {
        // silently fail
      })
  }, [])

  // 轮询：当有 pending/processing 状态时每 3 秒刷新
  useEffect(() => {
    const hasPending = history.some(
      (item) => item.ingestStatus === "pending" || item.ingestStatus === "processing"
    )

    if (hasPending) {
      pollingRef.current = setInterval(() => {
        fetchHistory(statusFilter)
      }, 3000)
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [history, fetchHistory, statusFilter])

  const handleIngestSuccess = useCallback(() => {
    fetchHistory(statusFilter)
  }, [fetchHistory, statusFilter])

  return (
    <SidebarInset className="min-w-0">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 bg-background">
        <div className="flex flex-1 items-center gap-2 px-3">
          <SidebarTrigger />
          <Separator className="mr-2 data-[orientation=vertical]:h-4" orientation="vertical" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="line-clamp-1">{t.ingest.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex min-w-0 flex-1 flex-col gap-6 p-4">
        <IngestForm folders={folders} onSuccess={handleIngestSuccess} t={t} />
        <Separator />
        <IngestHistory
          history={history}
          isLoading={isLoadingHistory}
          onFilterChange={setStatusFilter}
          statusFilter={statusFilter}
          t={t}
        />
      </div>
    </SidebarInset>
  )
}

function IngestForm({
  folders,
  onSuccess,
  t,
}: {
  folders: FolderInfo[]
  onSuccess: () => void
  t: ReturnType<typeof useT>
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div>
      <Tabs defaultValue="url">
        <TabsList>
          <TabsTrigger value="url">
            <Globe className="size-4" />
            {t.ingest.tabUrl}
          </TabsTrigger>
          <TabsTrigger value="file">
            <FileUp className="size-4" />
            {t.ingest.tabFile}
          </TabsTrigger>
          <TabsTrigger value="batch">
            <List className="size-4" />
            {t.ingest.tabBatch}
          </TabsTrigger>
          <TabsTrigger value="platform">
            <RefreshCw className="size-4" />
            {t.ingest.tabPlatform}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="url">
          <UrlIngestForm folders={folders} onSuccess={onSuccess} t={t} />
        </TabsContent>
        <TabsContent value="file">
          <FileIngestForm folders={folders} onSuccess={onSuccess} t={t} />
        </TabsContent>
        <TabsContent value="batch">
          <BatchIngestForm folders={folders} onSuccess={onSuccess} t={t} />
        </TabsContent>
        <TabsContent value="platform">
          <PlatformSyncForm t={t} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PlatformSyncForm({ t }: { t: ReturnType<typeof useT> }) {
  const [biliOpen, setBiliOpen] = useState(false)

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        className="flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted"
        onClick={() => setBiliOpen(true)}
      >
        <div className="flex size-10 items-center justify-center rounded-md bg-sky-50 text-sky-500 dark:bg-sky-950">
          <BilibiliIcon className="size-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-sm">Bilibili 收藏夹</h3>
          <p className="text-muted-foreground text-xs">自动解析并批量导入已收藏的视频</p>
        </div>
      </div>
      <BilibiliSyncDialog onOpenChange={setBiliOpen} open={biliOpen} />
    </div>
  )
}

function UrlIngestForm({
  folders,
  onSuccess,
  t,
}: {
  folders: FolderInfo[]
  onSuccess: () => void
  t: ReturnType<typeof useT>
}) {
  const [url, setUrl] = useState("")
  const [folderId, setFolderId] = useState("")
  const [title, setTitle] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmed,
          folderId: folderId || undefined,
          title: title.trim() || undefined,
          clientSource: "web",
        }),
      })
      if (res.ok) {
        toast.success(t.ingest.submitSuccess)
        setUrl("")
        setTitle("")
        onSuccess()
      } else {
        toast.error(t.ingest.submitFailed)
      }
    } catch {
      toast.error(t.ingest.submitFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <Input
          className="flex-1"
          disabled={submitting}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t.ingest.urlPlaceholder}
          type="url"
          value={url}
        />
        <Button disabled={submitting || !url.trim()} type="submit">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {submitting ? t.ingest.submitting : t.ingest.urlSubmit}
        </Button>
      </div>
      <FolderSelect
        disabled={submitting}
        folderId={folderId}
        folders={folders}
        onFolderChange={setFolderId}
        t={t}
      />
      <div className="space-y-2">
        <Label>{t.ingest.titleLabel}</Label>
        <Input
          disabled={submitting}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.ingest.titlePlaceholder}
          value={title}
        />
      </div>
    </form>
  )
}

function FileIngestForm({
  folders,
  onSuccess,
  t,
}: {
  folders: FolderInfo[]
  onSuccess: () => void
  t: ReturnType<typeof useT>
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [folderId, setFolderId] = useState("")
  const [title, setTitle] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    if (!selectedFile) {
      return
    }
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("clientSource", "web")
      if (folderId) {
        formData.append("folderId", folderId)
      }
      if (title.trim()) {
        formData.append("title", title.trim())
      }
      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      })
      if (res.ok) {
        toast.success(t.ingest.submitSuccess)
        setSelectedFile(null)
        setTitle("")
        onSuccess()
      } else {
        toast.error(t.ingest.submitFailed)
      }
    } catch {
      toast.error(t.ingest.submitFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
        onClick={() => !submitting && inputRef.current?.click()}
        onDragLeave={() => setDragOver(false)}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files[0]
          if (file) {
            setSelectedFile(file)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            inputRef.current?.click()
          }
        }}
        role="button"
        tabIndex={0}
      >
        <input
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              setSelectedFile(file)
            }
          }}
          ref={inputRef}
          type="file"
        />
        {selectedFile ? (
          <>
            <FileUp className="size-8 text-primary" />
            <p className="mt-2 font-medium text-sm">{selectedFile.name}</p>
          </>
        ) : (
          <>
            <FileUp className="size-8 text-muted-foreground" />
            <p className="mt-2 font-medium text-sm">{t.ingest.fileDragHint}</p>
            <p className="mt-1 text-muted-foreground text-xs">{t.ingest.fileSupported}</p>
          </>
        )}
      </div>
      <FolderSelect
        disabled={submitting}
        folderId={folderId}
        folders={folders}
        onFolderChange={setFolderId}
        t={t}
      />
      <div className="space-y-2">
        <Label>{t.ingest.titleLabel}</Label>
        <Input
          disabled={submitting}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.ingest.titlePlaceholder}
          value={title}
        />
      </div>
      <Button className="w-full" disabled={!selectedFile || submitting} onClick={handleSubmit}>
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {submitting ? t.ingest.submitting : t.ingest.urlSubmit}
      </Button>
    </div>
  )
}

function BatchIngestForm({
  folders,
  onSuccess,
  t,
}: {
  folders: FolderInfo[]
  onSuccess: () => void
  t: ReturnType<typeof useT>
}) {
  const [text, setText] = useState("")
  const [folderId, setFolderId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const urls = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    if (urls.length === 0) {
      return
    }

    setSubmitting(true)
    try {
      const results = await Promise.allSettled(
        urls.map((url) =>
          fetch("/api/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, folderId: folderId || undefined, clientSource: "web" }),
          })
        )
      )
      const successCount = results.filter((r) => r.status === "fulfilled" && r.value.ok).length
      toast.success(`${t.ingest.batchSuccess} (${successCount}/${urls.length})`)
      setText("")
      onSuccess()
    } catch {
      toast.error(t.ingest.submitFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
      <Textarea
        className="min-h-[120px]"
        disabled={submitting}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.ingest.batchPlaceholder}
        value={text}
      />
      <FolderSelect
        disabled={submitting}
        folderId={folderId}
        folders={folders}
        onFolderChange={setFolderId}
        t={t}
      />
      <Button className="self-end" disabled={submitting || !text.trim()} type="submit">
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {submitting ? t.ingest.submitting : t.ingest.batchSubmit}
      </Button>
    </form>
  )
}

const STATUS_FILTERS: StatusFilter[] = ["all", "pending", "processing", "completed", "failed"]

function IngestHistory({
  history,
  isLoading,
  statusFilter,
  onFilterChange,
  t,
}: {
  history: HistoryItem[]
  isLoading: boolean
  statusFilter: StatusFilter
  onFilterChange: (f: StatusFilter) => void
  t: ReturnType<typeof useT>
}) {
  const filterLabels: Record<StatusFilter, string> = {
    all: t.ingest.filterAll,
    pending: t.ingest.filterPending,
    processing: t.ingest.filterProcessing,
    completed: t.ingest.filterCompleted,
    failed: t.ingest.filterFailed,
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-lg">{t.ingest.history}</h2>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f}
              onClick={() => onFilterChange(f)}
              size="sm"
              variant={statusFilter === f ? "default" : "ghost"}
            >
              {filterLabels[f]}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {!isLoading && history.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">{t.ingest.emptyHistory}</p>
      )}
      {!isLoading && history.length > 0 && (
        <div className="flex flex-col gap-2">
          {history.map((item) => (
            <HistoryRow item={item} key={item.id} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status, t }: { status: string; t: ReturnType<typeof useT> }) {
  switch (status) {
    case "pending":
      return (
        <Badge className="gap-1" variant="secondary">
          <Clock className="size-3" />
          {t.ingest.statusPending}
        </Badge>
      )
    case "processing":
      return (
        <Badge className="gap-1" variant="secondary">
          <Loader2 className="size-3 animate-spin" />
          {t.ingest.statusProcessing}
        </Badge>
      )
    case "completed":
      return (
        <Badge className="gap-1" variant="default">
          <CheckCircle2 className="size-3" />
          {t.ingest.statusCompleted}
        </Badge>
      )
    case "failed":
      return (
        <Badge className="gap-1" variant="destructive">
          <AlertCircle className="size-3" />
          {t.ingest.statusFailed}
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function HistoryRow({ item, t }: { item: HistoryItem; t: ReturnType<typeof useT> }) {
  const urlPreview =
    item.url && item.url.length > MAX_URL_PREVIEW_LENGTH
      ? `${item.url.slice(0, MAX_URL_PREVIEW_LENGTH)}...`
      : item.url
  const sourceLabel = getSourceLabel(item, t)

  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-lg border p-3">
      {hasPlatformIcon(item.platform) ? (
        <PlatformIcon platform={item.platform!} />
      ) : (
        <Globe className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1 overflow-hidden">
        {item.ingestStatus === "completed" ? (
          <Link
            className="block truncate font-medium text-sm hover:underline"
            href={`/bookmark/${item.id}`}
          >
            {item.title}
          </Link>
        ) : (
          <p className="truncate font-medium text-sm">{item.title}</p>
        )}
        {urlPreview && <p className="truncate text-muted-foreground text-xs">{urlPreview}</p>}
        {item.ingestError && (
          <p className="mt-1 line-clamp-2 break-all text-destructive text-xs">{item.ingestError}</p>
        )}
      </div>
      <div className="grid shrink-0 grid-cols-[96px_96px_160px] items-center gap-3">
        <div className="flex justify-end">
          <Badge className="max-w-[96px] truncate text-[10px]" variant="outline">
            {sourceLabel}
          </Badge>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[96px]">
            <StatusBadge status={item.ingestStatus} t={t} />
          </div>
        </div>
        <span className="w-[160px] text-muted-foreground text-right text-xs">
          {new Date(item.createdAt).toLocaleString()}
        </span>
      </div>
    </div>
  )
}

function FolderSelect({
  folders,
  folderId,
  onFolderChange,
  disabled,
  t,
}: {
  folders: FolderInfo[]
  folderId: string
  onFolderChange: (v: string) => void
  disabled: boolean
  t: ReturnType<typeof useT>
}) {
  if (folders.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <Label>{t.ingest.folderLabel}</Label>
      <Select disabled={disabled} onValueChange={onFolderChange} value={folderId}>
        <SelectTrigger>
          <SelectValue placeholder={t.ingest.folderPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {folders.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.emoji} {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
