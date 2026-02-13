export default function handler(req, res) {
  const referer = req.headers.referer || '';
  
  if (!referer.includes('your-domain.vercel.app') && !referer.includes('localhost')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json({
    baseUrl: 'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com'
  });
}
