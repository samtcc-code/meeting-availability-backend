const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

app.get('/test', (req, res) => {
    res.json({ message: 'test route works' });
});

app.post('/api/scrape-and-convert', async (req, res) => {
    const { bookingLink, recipientTimezone } = req.body;
    
    if (!bookingLink || !recipientTimezone) {
        return res.status(400).json({ error: 'bookingLink and recipientTimezone required' });
    }
    
    try {
        // Fetch the booking page HTML
        const pageResponse = await fetch(bookingLink);
        if (!pageResponse.ok) {
            return res.status(400).json({ success: false, error: 'Could not access booking link' });
        }
        const pageHTML = await pageResponse.text();
        
        // Send to Claude to extract times
const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    messages: [{
        role: "user",
        content: `Extract available times from this booking page HTML and convert to ${recipientTimezone}.

Return ONLY JSON (no other text):
{"success":true,"emailHTML":"<p>Do any of these times work? All in [TZ].</p><ul><li>* [Date]: [time1], [time2]</li></ul>"}

HTML:
${pageHTML.substring(0, 2000)}`
    }]
});
        
        const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            return res.status(500).json({ success: false, error: 'Could not extract times from page' });
        }
        
        const result = JSON.parse(jsonMatch[0]);
        res.json(result);
        
    } catch (error) {
        console.error('Error:', error.message);
        
        if (error.status === 429) {
            return res.status(429).json({ 
                success: false,
                error: 'Rate limited. Please wait a moment and try again.' 
            });
        }
        
        res.status(500).json({ 
            success: false,
            error: error.message || 'Failed to process booking link' 
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend running on port ${PORT}`);
});
