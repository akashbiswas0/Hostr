import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

async function compressUnder100kb(buffer: Buffer): Promise<Buffer> {
  let quality = 80
  let compressed = buffer

  while (quality >= 10) {
    compressed = await sharp(buffer)
      .resize(400, 400, { fit: 'cover' })
      .jpeg({ quality })
      .toBuffer()

    if (compressed.length < 100 * 1024) break
    quality -= 10
  }

  return compressed
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt required' }, { status: 400 })
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      console.error('[generate-image] OpenRouter error:', response.status, err)

      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit reached. Try again in a minute.' },
          { status: 429 }
        )
      }

      return NextResponse.json(
        { error: `Generation failed: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[generate-image] response:', JSON.stringify(data).slice(0, 500))

    // Extract base64 from response — OpenRouter returns image as content array part
    let base64: string | null = null

    const content = data?.choices?.[0]?.message?.content
    if (Array.isArray(content)) {
      const imgPart = content.find((p: any) => p.type === 'image_url')
      if (imgPart?.image_url?.url) {
        base64 = imgPart.image_url.url.replace(/^data:image\/\w+;base64,/, '')
      }
    } else if (typeof content === 'string' && content.startsWith('data:image')) {
      // Some models return a data URL directly as a string
      base64 = content.replace(/^data:image\/\w+;base64,/, '')
    }

    if (!base64) {
      console.error('[generate-image] Could not parse image — full response:', JSON.stringify(data))
      return NextResponse.json({ error: 'No image in response' }, { status: 500 })
    }

    // ✅ Compress to under 100kb before returning
    const rawBuffer = Buffer.from(base64, 'base64')
    const compressed = await compressUnder100kb(rawBuffer)

    console.log(
      `[generate-image] ${(rawBuffer.length / 1024).toFixed(1)}kb → ${(compressed.length / 1024).toFixed(1)}kb`
    )

    return NextResponse.json({
      imageData: compressed.toString('base64'),
      mimeType: 'image/jpeg',
    })

  } catch (err: any) {
    console.error('[generate-image]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 }
    )
  }
}