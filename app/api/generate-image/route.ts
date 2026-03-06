import { NextRequest, NextResponse } from 'next/server'

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
        messages: [
          {
            role: 'user',
            content: prompt,
          }
        ],
        modalities: ['image', 'text'],  // ✅ required for image output
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
    console.log('[generate-image] response:', JSON.stringify(data).slice(0, 300))

    // ✅ OpenRouter returns images in message.images array
    const images = data?.choices?.[0]?.message?.images
    if (images && images.length > 0) {
      const dataUrl: string = images[0]?.image_url?.url ?? images[0]
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
      return NextResponse.json({ imageData: base64, mimeType: 'image/png' })
    }

    // Fallback: check content array for image_url parts
    const content = data?.choices?.[0]?.message?.content
    if (Array.isArray(content)) {
      const imgPart = content.find((p: any) => p.type === 'image_url')
      if (imgPart?.image_url?.url) {
        const base64 = imgPart.image_url.url.replace(/^data:image\/\w+;base64,/, '')
        return NextResponse.json({ imageData: base64, mimeType: 'image/png' })
      }
    }

    console.error('[generate-image] unexpected response shape:', data)
    return NextResponse.json({ error: 'No image in response' }, { status: 500 })

  } catch (err: any) {
    console.error('[generate-image]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 }
    )
  }
}