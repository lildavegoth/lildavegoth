const PIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const TARGET_SIZE = '1200x'

function decodePinItShort(shortCode) {
    const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_'
    let id = 0n
    for (let i = 0; i < shortCode.length; i++) {
        id = id * 64n + BigInt(alphabet.indexOf(shortCode[i]))
    }
    return id.toString()
}

function extractPinIdFromUrl(url) {
    const pinItMatch = url.match(/pin\.it\/([A-Za-z0-9_-]+)/)
    if (pinItMatch) {
        return decodePinItShort(pinItMatch[1])
    }

    const pinMatch = url.match(/\/pin\/(\d+)/)
    if (pinMatch) {
        return pinMatch[1]
    }

    throw new Error('Could not extract pin ID from URL')
}

async function handlePinResolve(url) {
    const pinId = extractPinIdFromUrl(url)

    const apiUrl = `https://www.pinterest.com/resource/PinResource/get/?data=${encodeURIComponent(JSON.stringify({ options: { id: pinId, field_set_key: 'detailed' } }))}`

    const apiResp = await fetch(apiUrl, {
        headers: {
            'User-Agent': PIN_UA,
            'Accept': 'application/json',
            'Referer': 'https://www.pinterest.com/'
        }
    })

    if (!apiResp.ok) {
        throw new Error(`PinResource API failed (${apiResp.status})`)
    }

    const json = await apiResp.json()
    const images = json.resource_response?.data?.images

    if (!images || !images.orig) {
        throw new Error('No image found in PinResource response')
    }

    const origUrl = images.orig.url
    const fullImageUrl = origUrl.replace(/\/originals\//, `/${TARGET_SIZE}/`)

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
