export default function handler(req, res) {
  const referer = req.headers.referer || '';
  
  if (!referer.includes('your-domain.vercel.app')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json({
    baseUrl: process.env.BLOB_STORAGE_URL,
    images: [
      'Kiraku%20Store/Images/kuriihara-thumb.webp',
      'Kiraku%20Store/Images/asashi-thumb.webp',
      'Kiraku%20Store/Images/kakoi-kiraku-thumb.webp'
    ]
  });
}
