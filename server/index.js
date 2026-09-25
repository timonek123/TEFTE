require('dotenv').config()

const express = require('express')

const app = express()
const PORT = 3000

app.use(express.json())

app.get('/', (req, res) => {
  res.json({
    message: 'Vendra AI server is running',
  })
})

app.post('/api/search', async (req, res) => {
  const { query } = req.body

  if (!query) {
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

Help the user understand what product best matches their request.
Be concise and practical.
Ask a clarifying question when important information is missing.
Do not claim that you found real marketplace listings unless actual product data was provided.
              `,
            },
            {
              role: 'user',
              content: query,
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

    const message = data.choices?.[0]?.message?.content

    res.json({
      message: message || 'Vendra did not return an answer.',
    })
  } catch (error) {
    console.error('Server error:', error)

    res.status(500).json({
      error: 'Vendra AI could not process the request.',
    })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Vendra AI server running on port ${PORT}`)
})