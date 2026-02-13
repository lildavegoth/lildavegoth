export default async function handler(req, res) {
  const { filename } = req.query;
  const referer = req.headers.referer || '';
  
  if (!referer.includes('https://kakoi-kiraku-home.vercel.app') && !referer.includes('localhost')) {
    return res.status(403).send('Forbidden');
  }

  try {
    const imageUrl = `https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Kiraku%20Store/Images/${filename}`;
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    
    res.setHeader('Content-Type', response.headers.get('content-type'));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(buffer));
  } catch {
    res.status(404).send('Not found');
  }
}
