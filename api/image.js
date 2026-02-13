export default async function handler(req, res) {
  const { filename } = req.query;
  const imageUrl = `${process.env.IMAGES_BASE_URL}/${filename}`;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    
    res.setHeader('Content-Type', response.headers.get('content-type'));
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(Buffer.from(buffer));
  } catch {
    res.status(404).send('');
  }
}
