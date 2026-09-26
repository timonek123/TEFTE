require('dotenv').config()

const express = require('express')
const products = require('./products.json')

const app = express()
const PORT = 3000

app.use(express.json())

app.get('/', (req, res) => {
  res.json({
    message: 'Vendra AI server is running',
    products: products.length,
  })
})

app.get('/api/products', (req, res) => {
  res.json(products)
})

app.post('/api/search', async (req, res) => {
  const { query } = req.body

  if (!query || !query.trim()) {
    return res.status(400).json({
      error: 'Query is required',
    })
  }

  try {
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          models: [
            'qwen/qwen3.8-27b:free',
            'openrouter/free',
          ],
          messages: [
            {
              role: 'system',
              content: `
You are Vendra, an AI shopping assistant.

Your job is to select the best matching products from the provided Vendra catalog.

RULES:
- Use ONLY products from the provided catalog.
- Never invent product IDs.
- Never invent products, prices or specifications.
- Respect the user's requirements such as budget, category, weight, condition and intended use.
- Select up to 3 best matching products.
- Put the best match first.
- If nothing matches, return an empty productIds array.

Return ONLY valid JSON.
Do not use Markdown.
Do not add text before or after the JSON.

Use exactly this format:

{
  "productIds": ["product-id-1", "product-id-2"],
  "summary": "Short explanation of why these products match."
}
              `,
            },
            {
              role: 'user',
              content: `
SHOPPING REQUEST:
${query.trim()}

VENDRA PRODUCT CATALOG:
${JSON.stringify(products, null, 2)}
              `,
            },
          ],
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('OpenRouter error:', data)

      return res.status(response.status).json({
        error: 'Vendra AI could not process the request.',
      })
    }

    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('AI returned an empty response')
    }

    const cleanedContent = content
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim()

    const aiResult = JSON.parse(cleanedContent)

    const requestedIds = Array.isArray(aiResult.productIds)
      ? aiResult.productIds
      : []

    const matchedProducts = requestedIds
      .map((id) => products.find((product) => product.id === id))
      .filter(Boolean)
      .slice(0, 3)

    res.json({
      summary:
        typeof aiResult.summary === 'string'
          ? aiResult.summary
          : '',
      products: matchedProducts,
    })
  } catch (error) {
    console.error('Search error:', error)

    res.status(500).json({
      error: 'Vendra AI could not process the request.',
    })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Vendra AI server running on port ${PORT}`)
  console.log(`Loaded ${products.length} products`)
})