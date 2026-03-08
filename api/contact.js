// Import the Resend library
import { Resend } from 'resend';

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Get the form data from the request body
  const { name, email, message } = req.body;

  // Basic validation – make sure all fields are present
  if (!name || !email || !message) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  try {
    // Send the email using Resend
    const { data, error } = await resend.emails.send({
      from: 'Your Website <onboarding@resend.dev>', // Use the default Resend sender for testing
      to: ['your-email@example.com'],               // Replace with your email address
      subject: `New message from ${name}`,
      reply_to: email,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ message: 'Failed to send email' });
    }

    // Success – send a response back to the browser
    // You can redirect to a "thank you" page or just show a message
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
}
