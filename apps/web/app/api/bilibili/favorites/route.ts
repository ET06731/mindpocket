import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getBilibiliCredentials } from "@/db/queries/bilibili-credentials"

export async function GET() {
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((m) => m.headers()),
  })

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const credentials = await getBilibiliCredentials(session.user.id)
  if (!credentials) {
    return NextResponse.json({ error: "No Bilibili credentials found" }, { status: 400 })
  }

  const cookieHeader = `SESSDATA=${credentials.sessdata}; bili_jct=${credentials.biliJct}; buvid3=${credentials.buvid3}`
  const headers = {
    Cookie: cookieHeader,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Referer: "https://www.bilibili.com",
  }

  try {
    // 1. 获取 uid
    const navRes = await fetch("https://api.bilibili.com/x/web-interface/nav", { headers })
    const navData = await navRes.json()
    if (navData.code !== 0 || !navData.data?.isLogin) {
      return NextResponse.json({ error: "Bilibili token invalid or expired" }, { status: 401 })
    }
    const uid = navData.data.mid

    // 2. 获取创建的收藏夹
    const favRes = await fetch(`https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${uid}`, { headers })
    const favData = await favRes.json()
    if (favData.code !== 0) {
      return NextResponse.json({ error: favData.message || "Failed to fetch folders" }, { status: 400 })
    }

    return NextResponse.json({
      folders: favData.data?.list || []
    })
  } catch (error) {
    console.error("[bilibili favorites]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
