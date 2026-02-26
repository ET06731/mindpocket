"use client"

import { Check, Loader2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n"
import { BilibiliSyncDialog } from "@/components/settings/bilibili-sync-dialog"

export function SettingsBilibili() {
  const t = useT()
  const [hasCredentials, setHasCredentials] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [sessdata, setSessdata] = useState("")
  const [biliJct, setBiliJct] = useState("")
  const [buvid3, setBuvid3] = useState("")
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showSyncDialog, setShowSyncDialog] = useState(false)

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/bilibili-credentials")
      if (res.ok) {
        const data = await res.json()
        setHasCredentials(data.hasCredentials)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    if (!(sessdata && biliJct && buvid3)) {
      toast.error("请填写所有字段")
      return
    }

    setTesting(true)
    try {
      const res = await fetch("/api/bilibili-credentials/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessdata, biliJct, buvid3 }),
      })

      const data = await res.json()

      if (data.valid) {
        toast.success("凭证验证成功！")
      } else {
        toast.error("凭证无效", { description: data.error || data.details })
      }
    } catch {
      toast.error("测试失败，请检查网络连接")
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!(sessdata && biliJct && buvid3)) {
      toast.error("请填写所有字段")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/bilibili-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessdata, biliJct, buvid3 }),
      })

      if (res.ok) {
        toast.success("凭证保存成功！")
        setShowForm(false)
        setSessdata("")
        setBiliJct("")
        setBuvid3("")
        await fetchStatus()
      } else {
        const data = await res.json()
        toast.error(data.error || "保存失败")
      }
    } catch {
      toast.error("保存失败，请检查网络连接")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/bilibili-credentials", {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("凭证已删除")
        await fetchStatus()
      } else {
        const data = await res.json()
        toast.error(data.error || "删除失败")
      }
    } catch {
      toast.error("删除失败，请检查网络连接")
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setSessdata("")
    setBiliJct("")
    setBuvid3("")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 font-medium text-sm">Bilibili 字幕提取</h3>
        <p className="mb-4 text-muted-foreground text-xs">
          配置 Bilibili 登录凭证后，系统会自动为 B 站视频提取字幕内容
        </p>

        {hasCredentials && !showForm && (
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-green-600" />
              <span className="text-sm">已配置 Bilibili 凭证</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowSyncDialog(true)} size="sm" variant="secondary">
                同步收藏夹
              </Button>
              <Button onClick={() => setShowForm(true)} size="sm" variant="outline">
                更新
              </Button>
              <Button disabled={saving} onClick={handleDelete} size="sm" variant="destructive">
                删除
              </Button>
            </div>
          </div>
        )}

        {(!hasCredentials || showForm) && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">{hasCredentials ? "更新凭证" : "配置凭证"}</h4>
              {showForm && (
                <Button onClick={handleCancel} size="sm" variant="ghost">
                  <X className="size-4" />
                </Button>
              )}
            </div>

            <div className="space-y-1.5 rounded-md bg-blue-50 p-3 dark:bg-blue-950">
              <p className="font-medium text-xs">如何获取 Cookie？</p>
              <ol className="list-decimal list-inside space-y-0.5 text-xs">
                <li>登录 bilibili.com</li>
                <li>按 F12 打开开发者工具</li>
                <li>进入 Application → Cookies</li>
                <li>复制以下三个值：</li>
              </ol>
              <ul className="list-disc list-inside ml-4 text-xs">
                <li>
                  <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">SESSDATA</code>
                </li>
                <li>
                  <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">bili_jct</code>
                </li>
                <li>
                  <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">buvid3</code>
                </li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">SESSDATA</Label>
              <Input
                onChange={(e) => setSessdata(e.target.value)}
                placeholder="输入 SESSDATA"
                type="password"
                value={sessdata}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">bili_jct</Label>
              <Input
                onChange={(e) => setBiliJct(e.target.value)}
                placeholder="输入 bili_jct"
                type="password"
                value={biliJct}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">buvid3</Label>
              <Input
                onChange={(e) => setBuvid3(e.target.value)}
                placeholder="输入 buvid3"
                type="text"
                value={buvid3}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button disabled={testing || saving} onClick={handleTest} size="sm" variant="outline">
                {testing && <Loader2 className="mr-1 size-3 animate-spin" />}
                测试
              </Button>
              <Button disabled={saving || testing} onClick={handleSave} size="sm">
                {saving && <Loader2 className="mr-1 size-3 animate-spin" />}
                保存
              </Button>
              {showForm && (
                <Button onClick={handleCancel} size="sm" variant="outline">
                  取消
                </Button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950">
        <p className="text-xs">
          <strong>注意：</strong>凭证将被加密存储。Cookie
          有过期时间，如果字幕提取失败，请尝试更新凭证。
        </p>
      </section>

      <BilibiliSyncDialog open={showSyncDialog} onOpenChange={setShowSyncDialog} />
    </div>
  )
}
