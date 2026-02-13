export default async function handler(req, res) {
  try {
    const [productsRes, ownedRes] = await Promise.all([
      fetch(process.env.PRODUCTS_URL),
      fetch(process.env.OWNED_URL)
    ]);
    
    const products = await productsRes.json();
    const owned = await ownedRes.json();
    
    res.setHeader('Cache-Control', 's-maxage=3600');
    res.status(200).json({ products, owned });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
}
