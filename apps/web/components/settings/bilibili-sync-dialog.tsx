"use client"

import { Play, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useBookmarkStore, useFolderStore } from "@/stores"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Folder {
  id: number
  title: string
  media_count: number
}

interface BilibiliSyncDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BilibiliSyncDialog({ open, onOpenChange }: BilibiliSyncDialogProps) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [progress, setProgress] = useState({ total: 0, current: 0 })
  const [statusText, setStatusText] = useState("")

  const { fetchFolders: refreshFolders } = useFolderStore()
  const { fetchBookmarks: refreshBookmarks } = useBookmarkStore()

  useEffect(() => {
    if (open) {
      fetchFolders()
    } else {
      setFolders([])
      setStatusText("")
      setProgress({ total: 0, current: 0 })
      setSyncing(false)
    }
  }, [open])

  const fetchFolders = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/bilibili/favorites")
      const data = await res.json()
      if (res.ok) {
        setFolders(data.folders || [])
      } else {
        toast.error(data.error || "获取收藏夹失败，请检查凭证")
        onOpenChange(false)
      }
    } catch (err) {
      toast.error("网络异常")
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async (folder: Folder) => {
    if (syncing) return
    setSyncing(true)
    setProgress({ total: folder.media_count, current: 0 })
    setStatusText("正在检查文件夹...")

    try {
      // 1. 获取现有文件夹并创建关联文件夹
      const foldersRes = await fetch("/api/folders")
      const foldersData = await foldersRes.json()
      let targetFolderId = ""

      if (foldersRes.ok && foldersData.folders) {
        const existingFolder = foldersData.folders.find((f: any) => f.name === folder.title)
        if (existingFolder) {
          targetFolderId = existingFolder.id
        }
      }

      if (!targetFolderId) {
        setStatusText("正在创建对应的文件夹...")
        const createRes = await fetch("/api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: folder.title, emoji: "📺" }),
        })
        const createData = await createRes.json()
        if (createRes.ok && createData.folder) {
          targetFolderId = createData.folder.id
        }
      }

      setStatusText("正在获取视频列表...")

      let page = 1
      let hasMore = true
      const videos: { bvid: string; title: string }[] = []

      while (hasMore) {
        const res = await fetch(`/api/bilibili/favorites/${folder.id}?pn=${page}&ps=20`)
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || "获取列表失败")
        }

        const medias = data.medias || []
        for (const m of medias) {
          if (m.bvid && m.title !== "已失效视频") {
            videos.push({ bvid: m.bvid, title: m.title })
          }
        }

        hasMore = data.hasMore ?? medias.length === 20
        page += 1
      }

      setProgress((p) => ({ ...p, total: videos.length }))

      const CONCURRENCY = 3
      let completed = 0

      setStatusText("正在导入到书签库...")

      const queue = [...videos]

      const worker = async () => {
        while (queue.length > 0) {
          const video = queue.shift()
          if (!video || !video.bvid) continue

          const url = `https://www.bilibili.com/video/${video.bvid}`
          const bodyPayload: any = {
            url,
            title: video.title,
            clientSource: "bilibili_sync",
          }
          if (targetFolderId) {
            bodyPayload.folderId = targetFolderId
          }

          try {
            await fetch("/api/ingest", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(bodyPayload),
            })
          } catch (e) {
            console.error("Sync failed for", video.bvid)
          }

          completed += 1
          setProgress((p) => ({ ...p, current: completed }))
        }
      }

      const workers = Array(CONCURRENCY).fill(null).map(worker)
      await Promise.all(workers)

      setStatusText("同步完成！")
      toast.success(`成功导入 ${completed} 个视频`)
    } catch (err: any) {
      toast.error(err.message || "同步异常")
      setStatusText("同步异常")
    } finally {
      refreshFolders(true)
      refreshBookmarks(true)
      setSyncing(false)
      setTimeout(() => {
        if (open) {
          onOpenChange(false)
        }
      }, 2000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !syncing && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>同步 B 站收藏夹</DialogTitle>
          <DialogDescription>
            选中后将自动在后台进行解析并保存，导入过程请不要关闭页面。
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {syncing ? (
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{statusText}</span>
                <span className="font-medium">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <Progress
                value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
              />
            </div>
          ) : loading ? (
            <div className="flex h-32 items-center justify-center">
              <RefreshCw className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[250px] rounded-md border p-2">
              {folders.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  没有找到收藏夹 (如果你刚配置凭证，可能缓存了请稍后再试)
                </div>
              ) : (
                <div className="space-y-2">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted"
                    >
                      <div className="space-y-1">
                        <p className="line-clamp-1 font-medium text-sm">{folder.title}</p>
                        <p className="text-muted-foreground text-xs">{folder.media_count} 个内容</p>
                      </div>
                      <Button
                        onClick={() => handleSync(folder)}
                        size="sm"
                        variant="secondary"
                        className="shrink-0 ml-2"
                      >
                        <Play className="mr-1 size-3" />
                        同步
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
