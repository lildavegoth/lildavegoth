export default async function handler(req, res) {
  const { filename } = req.query;
  const referer = req.headers.referer || '';
  
  if (!referer.includes('your-domain.vercel.app')) {
    return res.status(403).send('Forbidden');
  }

  try {
    const imageUrl = `${process.env.BLOB_STORAGE_URL}/Kiraku%20Store/Images/${filename}`;
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    
    res.setHeader('Content-Type', response.headers.get('content-type'));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(404).send('Not found');
  }
}
