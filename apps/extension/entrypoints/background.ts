export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "SAVE_PAGE") {
      handleSavePage().then(sendResponse)
      return true
    } else if (message.type === "BATCH_SAVE_PAGES") {
      handleBatchSavePages(message.bookmarks).then(sendResponse)
      return true
    }
  })
})

async function notify(title: string, message: string) {
  await browser.notifications.create({
    type: "basic",
    iconUrl: browser.runtime.getURL("/icon/128.png"),
    title,
    message,
  })
}

async function handleSavePage() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
      return { success: false, error: "No active tab" }
    }

    const response = await browser.tabs.sendMessage(tab.id, { type: "GET_PAGE_CONTENT" })
    if (!response?.html) {
      return { success: false, error: "Failed to get page content" }
    }

    // TODO: 来源，更多参数
    const { saveBookmark } = await import("../lib/auth-client")
    const result = await saveBookmark({
      url: response.url,
      html: response.html,
      title: response.title,
    })

    if (!result.ok) {
      const error = result.data?.error || "Save failed"
      await notify("保存失败", error)
      return { success: false, error }
    }

    await notify("已收藏", result.data?.title || response.title || "页面已保存")
    return { success: true, data: result.data }
  } catch (err) {
    await notify("保存失败", String(err))
    return { success: false, error: String(err) }
  }
}

async function handleBatchSavePages(bookmarks: { url: string; title: string; html: string }[]) {
  try {
    if (!bookmarks || bookmarks.length === 0) {
      return { success: false, error: "No bookmarks to save" }
    }

    const { saveBookmark } = await import("../lib/auth-client")
    let successCount = 0

    // Concurrency limit to avoid overwhelming the server
    const CONCURRENCY = 3
    const queue = [...bookmarks]
    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift()
        if (!item) continue

        try {
          const res = await saveBookmark({
            url: item.url,
            title: item.title,
            html: item.html,
          })
          if (res.ok) successCount++
        } catch (e) {
          console.error("Failed to save", item.url, e)
        }
      }
    }

    const workers = Array(CONCURRENCY).fill(null).map(worker)
    await Promise.all(workers)

    await notify("批量收藏完成", `成功导入 ${successCount} 个推文`)
    return { success: true, count: successCount }
  } catch (err) {
    await notify("批量保存失败", String(err))
    return { success: false, error: String(err) }
  }
}
