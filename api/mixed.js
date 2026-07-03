const PIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const TARGET_SIZE = '1200x'

async function handlePinResolve(url) {
    const oembedUrl = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(url)}`
    const oembedResp = await fetch(oembedUrl, {
        headers: { 'User-Agent': PIN_UA }
    })

    if (oembedResp.ok) {
        const oembedData = await oembedResp.json()
        const oembedImage = oembedData.image_url
        if (!oembedImage) {
            throw new Error('No image found in oEmbed response')
        }
        const fullImageUrl = oembedImage.replace(/\/\d+x\//, `/${TARGET_SIZE}/`)
        return { fullImageUrl }
    }

    const firstResp = await fetch(url, {
        redirect: 'manual',
        headers: {
            'User-Agent': PIN_UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
        }
    })

    let pinPageUrl = firstResp.headers.get('location')
    if (!pinPageUrl) {
        throw new Error('Could not resolve pin.it link (no redirect location)')
    }

    const fallbackOembedUrl = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(pinPageUrl)}`
    const fallbackResp = await fetch(fallbackOembedUrl, {
        headers: { 'User-Agent': PIN_UA }
    })

    if (!fallbackResp.ok) {
        const errorText = await fallbackResp.text()
        throw new Error(`oEmbed failed (${fallbackResp.status}): ${errorText}`)
    }

    const oembedData = await fallbackResp.json()
    return { debug: oembedData }
}

export default async function handler(req, res) {
    const { type, url } = req.query

    if (!type || !url) {
        return res.status(400).json({ error: 'Missing "type" or "url" query parameter' })
    }

    try {
        if (type === 'pin-resolve') {
            const data = await handlePinResolve(url)
            return res.status(200).json(data)
        }

        res.status(400).json({ error: `Unsupported type: ${type}` })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}
