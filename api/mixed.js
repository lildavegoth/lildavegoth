const PIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const TARGET_SIZE = '1200x'

async function handlePinResolve(url) {
    const oembedUrl = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(url)}`
    const oembedResp = await fetch(oembedUrl, {
        headers: { 'User-Agent': PIN_UA }
    })

    if (!oembedResp.ok) {
        const errorText = await oembedResp.text()
        throw new Error(`oEmbed failed (${oembedResp.status}): ${errorText}`)
    }

    const oembedData = await oembedResp.json()
    const oembedImage = oembedData.image_url

    if (!oembedImage) {
        throw new Error('No image found in oEmbed response')
    }

    const fullImageUrl = oembedImage.replace(/\/\d+x\//, `/${TARGET_SIZE}/`)
    return { fullImageUrl }
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
