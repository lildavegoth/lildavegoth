const PIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const TARGET_SIZE = '1200x'

async function handlePinResolve(url) {
    const firstResp = await fetch(url, {
        redirect: 'follow',
        headers: {
            'User-Agent': PIN_UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
        }
    })

    const pinPageUrl = firstResp.url

    const oembedUrl = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(pinPageUrl)}`
    const oembedResp = await fetch(oembedUrl, {
        headers: { 'User-Agent': PIN_UA }
    })

    if (!oembedResp.ok) {
        const errorText = await oembedResp.text()
        throw new Error(`oEmbed failed (${oembedResp.status}): ${errorText}`)
    }

    const oembedData = await oembedResp.json()
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
