const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/test', (req, res) => {
    res.json({ message: 'test route works' });
});

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

app.post('/api/scrape-and-convert', async (req, res) => {
    const { bookingLink, recipientTimezone } = req.body;
    
    if (!bookingLink || !recipientTimezone) {
        return res.status(400).json({ error: 'bookingLink and recipientTimezone required' });
    }
    
    try {
        const message = await client.messages.create({
            model: "claude-opus-4-6",
            max_tokens: 1024,
            messages: [{
                role: "user",
                content: `Visit this booking link and extract available times: ${bookingLink}
                
Convert all times to ${recipientTimezone} timezone.

Return ONLY a JSON object with this exact structure:
{
    "success": true,
    "emailHTML": "<p>Do any of these times work for you? All are in [TZ].</p><ul><li>* [Date]: [time1], [time2], ...</li></ul>",
    "error": null
}

If you can't access the link, return:
{
    "success": false,
    "emailHTML": null,
    "error": "Could not scrape [service]. Visit the link directly or ask to use the main booking link."
}`
            }]
        });
        
        const responseText = message.content[0].text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            return res.status(500).json({ error: 'Failed to parse Claude response' });
        }
        
        const result = JSON.parse(jsonMatch[0]);
        res.json(result);
        
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend running on port ${PORT}`);
});
