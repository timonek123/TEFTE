require('dotenv').config()

const express = require('express')
const multer = require('multer')
const products = require('./products.json')

const app = express()
const PORT = 3000

app.use(express.json())

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
})

app.get('/', (req, res) => {
  res.json({
    message: 'TEFTE AI server is running',
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
You are TEFTE, an AI shopping assistant.

Your job is to select the best matching products from the provided TEFTE catalog.

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

TEFTE PRODUCT CATALOG:
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
        error: 'TEFTE AI could not process the request.',
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
      error: 'TEFTE AI could not process the request.',
    })
  }
})

app.post(
  '/api/analyze-product',
  upload.single('image'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'Product image is required.',
      })
    }

    try {
      const mimeType = req.file.mimetype || 'image/jpeg'
      const base64Image = req.file.buffer.toString('base64')
      const dataUrl = `data:${mimeType};base64,${base64Image}`

      console.log(
        `Analyzing product image: ${req.file.originalname} (${Math.round(
          req.file.size / 1024
        )} KB)`
      )

      const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openrouter/free',
            messages: [
              {
                role: 'system',
                content: `
You are TEFTE AI, an assistant that helps people create marketplace listings from photos.

Analyze the product visible in the image.

Your goal is to create a useful draft listing, but do not pretend to know details that cannot reasonably be inferred from the photo.

RULES:
- Identify the main item being sold.
- Keep the title concise and marketplace-friendly.
- Choose one broad marketplace category.
- Estimate condition only from visible evidence.
- Write a short natural description.
- Suggest a reasonable approximate price in USDC.
- Do not invent hidden specifications, exact model numbers, authenticity, age or functionality unless clearly visible.
- The seller will review and edit everything before publishing.

Allowed categories:
Electronics
Home
Fashion
Sports
Outdoor
Vehicles
Gaming
Collectibles
Other

Allowed condition values:
New
Like new
Good
Fair

Return ONLY valid JSON.
Do not use Markdown.
Do not add any text before or after the JSON.

Use exactly this structure:

{
  "title": "Product title",
  "category": "Home",
  "condition": "Good",
  "description": "Short marketplace description.",
  "suggestedPrice": 20
}
                `,
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Create a TEFTE marketplace listing draft for the main item in this photo.',
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: dataUrl,
                    },
                  },
                ],
              },
            ],
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error('OpenRouter vision error:', data)

        return res.status(response.status).json({
          error: 'TEFTE AI could not analyze the image.',
        })
      }

      const content = data.choices?.[0]?.message?.content

      if (!content) {
        throw new Error('Vision AI returned an empty response')
      }

      const cleanedContent = content
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim()

      const aiResult = JSON.parse(cleanedContent)

      const allowedCategories = [
        'Electronics',
        'Home',
        'Fashion',
        'Sports',
        'Outdoor',
        'Vehicles',
        'Gaming',
        'Collectibles',
        'Other',
      ]

      const allowedConditions = [
        'New',
        'Like new',
        'Good',
        'Fair',
      ]

      const suggestedPrice = Number(aiResult.suggestedPrice)

      const listing = {
        title:
          typeof aiResult.title === 'string'
            ? aiResult.title.trim()
            : 'Untitled item',

        category: allowedCategories.includes(aiResult.category)
          ? aiResult.category
          : 'Other',

        condition: allowedConditions.includes(aiResult.condition)
          ? aiResult.condition
          : 'Good',

        description:
          typeof aiResult.description === 'string'
            ? aiResult.description.trim()
            : '',

        suggestedPrice:
          Number.isFinite(suggestedPrice) && suggestedPrice >= 0
            ? suggestedPrice
            : 0,
      }

      console.log('TEFTE AI listing:', listing)

      res.json({
        listing,
      })
    } catch (error) {
      console.error('Vision analysis error:', error)

      res.status(500).json({
        error: 'TEFTE AI could not analyze the image.',
      })
    }
  }
)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TEFTE AI server running on port ${PORT}`)
  console.log(`Loaded ${products.length} products`)
})