import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getBilibiliCredentials } from "@/db/queries/bilibili-credentials"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
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

  const { searchParams } = new URL(request.url)
  const pn = searchParams.get("pn") || "1"
  const ps = searchParams.get("ps") || "20"
  
  const { mediaId } = await params

  const cookieHeader = `SESSDATA=${credentials.sessdata}; bili_jct=${credentials.biliJct}; buvid3=${credentials.buvid3}`
  const headers = {
    Cookie: cookieHeader,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Referer: "https://www.bilibili.com",
  }

  try {
    const res = await fetch(
      `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${mediaId}&pn=${pn}&ps=${ps}`,
      { headers }
    )
    const data = await res.json()
    if (data.code !== 0) {
      return NextResponse.json({ error: data.message || "Failed to fetch folder resources" }, { status: 400 })
    }

    return NextResponse.json({
      info: data.data?.info,
      medias: data.data?.medias || [],
      hasMore: data.data?.has_more
    })
  } catch (error) {
    console.error("[bilibili folder resources]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
