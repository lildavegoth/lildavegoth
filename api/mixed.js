export default async function handler(req, res) {
  const { url } = req.query

  if (!url) {
    return res.status(400).json({ error: 'Missing "url" query parameter' })
  }

  try {
    const redirectResp = await fetch(url, { redirect: 'follow' })
    const pinPageUrl = redirectResp.url

    const oembedUrl = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(pinPageUrl)}`
    const oembedResp = await fetch(oembedUrl)

    if (!oembedResp.ok) {
      throw new Error(`oEmbed failed with status ${oembedResp.status}`)
    }

    const oembedData = await oembedResp.json()
    const oembedImage = oembedData.image_url

    if (!oembedImage) {
      throw new Error('No image found in oEmbed response')
    }

    const TARGET_SIZE = '1200x'
    const fullImageUrl = oembedImage.replace(/\/\d+x\//, `/${TARGET_SIZE}/`)

    res.status(200).json({ fullImageUrl })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
