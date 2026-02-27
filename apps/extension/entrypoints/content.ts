export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "GET_PAGE_CONTENT") {
        sendResponse({
          url: window.location.href,
          title: document.title,
          html: document.documentElement.outerHTML,
        })
      } else if (message.type === "EXTRACT_TWITTER_BOOKMARKS") {
        const bookmarks = extractTwitterBookmarksFromDOM()
        sendResponse({ bookmarks })
      }
      return true
    })
  },
})

function extractTwitterBookmarksFromDOM() {
  const articles = document.querySelectorAll('article[data-testid="tweet"]')
  const bookmarks: { url: string; title: string; html: string }[] = []

  articles.forEach((article) => {
    // 寻找推文里的时间链接，它包含了对应的推文 URL
    const timeLink = article.querySelector('a[dir="auto"] > time')?.closest("a")
    if (timeLink) {
      const url = timeLink.href

      // 作者和文案
      const authorElem = article.querySelector('[data-testid="User-Name"]')
      const authorText = authorElem ? authorElem.textContent : "Unknown"

      const textElem = article.querySelector('[data-testid="tweetText"]')
      const tweetText = textElem ? textElem.textContent : ""

      const title = `${authorText}: ${tweetText}`.slice(0, 100)

      bookmarks.push({
        url,
        title: title || "Twitter Bookmark",
        html: article.outerHTML,
      })
    }
  })

  return bookmarks
}
