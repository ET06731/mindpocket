import { useEffect, useState } from "react"
import {
  getCachedUser,
  getServerUrl,
  getSession,
  removeCachedUser,
  setCachedUser,
  setServerUrl,
  signIn,
  signOut,
} from "../../lib/auth-client"
import { detectPlatform, PLATFORM_CONFIG } from "../../lib/platform-icons"
import "./App.css"

interface User {
  id: string
  name: string
  email: string
}
type Status = "idle" | "loading" | "success" | "error"
const WWW_PREFIX_REGEX = /^www\./
const TRAILING_SLASH_REGEX = /\/+$/

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [page, setPage] = useState<"main" | "settings">("main")

  useEffect(() => {
    getCachedUser().then((cached) => {
      if (cached) {
        setUser(cached)
        setChecking(false)
      }

      getSession()
        .then((res) => {
          if (res.ok && res.data?.user) {
            setUser(res.data.user)
            setCachedUser(res.data.user)
          } else {
            setUser(null)
            removeCachedUser()
          }
        })
        .catch((err) => {
          console.error("[MindPocket] getSession error:", err)
          if (!cached) {
            setUser(null)
          }
        })
        .finally(() => setChecking(false))
    })
  }, [])

  if (checking) {
    return (
      <div className="app">
        <p className="status">检查登录状态...</p>
      </div>
    )
  }

  if (page === "settings") {
    return <SettingsPage onBack={() => setPage("main")} />
  }

  if (!user) {
    return <LoginForm onLogin={setUser} />
  }

  return (
    <SavePage onLogout={() => setUser(null)} onSettings={() => setPage("settings")} user={user} />
  )
}

function LoginForm({ onLogin }: { onLogin: (user: User) => void }) {
  const [server, setServer] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState("")

  useEffect(() => {
    getServerUrl().then(setServer)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("loading")
    setError("")

    const trimmed = server.replace(TRAILING_SLASH_REGEX, "")
    await setServerUrl(trimmed)

    try {
      const res = await signIn(email, password)
      console.log("[MindPocket] signIn res:", JSON.stringify(res, null, 2))
      if (res.ok && res.data?.user) {
        setStatus("success")
        onLogin(res.data.user)
      } else {
        setStatus("error")
        setError(`登录失败 [${res.status}]: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      console.error("[MindPocket] signIn catch:", err)
      setStatus("error")
      setError(`请求异常: ${err}`)
    }
  }

  return (
    <div className="app">
      <h1 style={{ fontSize: 16, fontWeight: 600 }}>MindPocket</h1>
      <form className="form" onSubmit={handleSubmit}>
        <input
          className="input"
          onChange={(e) => setServer(e.target.value)}
          placeholder="服务器地址"
          required
          type="url"
          value={server}
        />
        <input
          className="input"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="邮箱"
          required
          type="email"
          value={email}
        />
        <input
          className="input"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码"
          required
          type="password"
          value={password}
        />
        <button className="btn btn-primary" disabled={status === "loading"} type="submit">
          {status === "loading" ? "登录中..." : "登录"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  )
}

function SavePage({
  user,
  onLogout,
  onSettings,
}: {
  user: User
  onLogout: () => void
  onSettings: () => void
}) {
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState("")
  const [pageInfo, setPageInfo] = useState<{
    url: string
    title: string
    platform: string | null
  } | null>(null)

  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url && tab.title) {
        setPageInfo({
          url: tab.url,
          title: tab.title,
          platform: detectPlatform(tab.url),
        })
      }
    })
  }, [])

  const handleSave = async () => {
    setStatus("loading")
    setMessage("")

    const res = await browser.runtime.sendMessage({ type: "SAVE_PAGE" })
    if (res?.success) {
      setStatus("success")
      setMessage(`已保存: ${res.data?.title || "页面"}`)
    } else {
      setStatus("error")
      setMessage(res?.error || "保存失败")
    }
  }

  const handleTwitterBatchSave = async () => {
    setStatus("loading")
    setMessage("提取推文中...")

    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) throw new Error("No active tab")

      const response = await browser.tabs.sendMessage(tab.id, { type: "EXTRACT_TWITTER_BOOKMARKS" })
      if (!response?.bookmarks || response.bookmarks.length === 0) {
        throw new Error("没找到推文，请向下滑动加载后重试")
      }

      setMessage(`提取到 ${response.bookmarks.length} 条推文，正在导入...`)

      const saveRes = await browser.runtime.sendMessage({
        type: "BATCH_SAVE_PAGES",
        bookmarks: response.bookmarks,
      })

      if (saveRes?.success) {
        setStatus("success")
        setMessage(`批量导入成功: ${saveRes.count} 条记录`)
      } else {
        throw new Error(saveRes?.error || "导入失败")
      }
    } catch (err: any) {
      setStatus("error")
      setMessage(err.message || String(err))
    }
  }

  const isTwitterBookmarks = pageInfo?.url?.match(/^https?:\/\/(x|twitter)\.com\/i\/bookmarks/i)

  return (
    <div className="app">
      <div className="header">
        <h1>MindPocket</h1>
        <div className="header-actions">
          <button className="settings-btn" onClick={onSettings} title="设置" type="button">
            <svg
              className="lucide lucide-settings-icon lucide-settings"
              fill="none"
              height="20"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>设置</title>
              <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button
            className="logout-btn"
            onClick={async () => {
              await signOut()
              onLogout()
            }}
            type="button"
          >
            退出
          </button>
        </div>
      </div>
      <p className="user-info">{user.email}</p>
      {pageInfo && (
        <div className="page-info">
          {pageInfo.platform && PLATFORM_CONFIG[pageInfo.platform] ? (
            (() => {
              const config = PLATFORM_CONFIG[pageInfo.platform]
              const Icon = config.icon
              return (
                <span className="platform-badge">
                  <Icon style={{ width: 14, height: 14, color: config.color }} />
                  <span>{config.label}</span>
                </span>
              )
            })()
          ) : (
            <span className="platform-badge">
              <span>{new URL(pageInfo.url).hostname.replace(WWW_PREFIX_REGEX, "")}</span>
            </span>
          )}
          <p className="page-title">{pageInfo.title}</p>
        </div>
      )}

      {isTwitterBookmarks ? (
        <button
          className="btn btn-save"
          style={{ backgroundColor: "#1d9bf0" }}
          disabled={status === "loading"}
          onClick={handleTwitterBatchSave}
          type="button"
        >
          {status === "loading" ? "处理中..." : "批量提取推特收藏"}
        </button>
      ) : (
        <button
          className="btn btn-save"
          disabled={status === "loading"}
          onClick={handleSave}
          type="button"
        >
          {status === "loading" ? "保存中..." : "收藏此页面"}
        </button>
      )}
      {status === "success" && <p className="success">{message}</p>}
      {status === "error" && <p className="error">{message}</p>}
    </div>
  )
}

function SettingsPage({ onBack }: { onBack: () => void }) {
  const [serverUrl, setServerUrlState] = useState("")
  const [status, setStatus] = useState<Status>("idle")

  useEffect(() => {
    getServerUrl().then(setServerUrlState)
  }, [])

  const handleSave = async () => {
    const trimmed = serverUrl.replace(TRAILING_SLASH_REGEX, "")
    setStatus("loading")
    await setServerUrl(trimmed)
    setServerUrlState(trimmed)
    setStatus("success")
    setTimeout(() => setStatus("idle"), 1500)
  }

  return (
    <div className="app">
      <div className="header">
        <h1 style={{ fontSize: 16, fontWeight: 600 }}>设置</h1>
        <button className="settings-btn" onClick={onBack} type="button">
          ← 返回
        </button>
      </div>
      <label className="settings-label" htmlFor="server-url">
        服务器地址
      </label>
      <input
        className="input"
        id="server-url"
        onChange={(e) => setServerUrlState(e.target.value)}
        placeholder="http://127.0.0.1:3000"
        value={serverUrl}
      />
      <button
        className="btn btn-primary"
        disabled={status === "loading"}
        onClick={handleSave}
        type="button"
      >
        {status === "success" ? "已保存" : "保存"}
      </button>
    </div>
  )
}

export default App
