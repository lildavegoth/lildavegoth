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
    const oembedImage = oembedData.image_url
    if (!oembedImage) {
        throw new Error('No image found in oEmbed response')
    }

    const fullImageUrl = oembedImage.replace(/\/\d+x\//, `/${TARGET_SIZE}/`)
    return { fullImageUrl }
}
