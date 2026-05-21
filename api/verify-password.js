const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { password } = JSON.parse(body);
            if (password !== process.env.ADMIN_PASSWORD) {
                return res.status(401).json({ error: 'Wrong password' });
            }
            const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '30d' });
            res.status(200).json({ token });
        } catch (e) {
            res.status(500).json({ error: 'Invalid request' });
        }
    });
};
