require('dotenv').config()

const express = require('express')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const products = require('./products.json')

const app = express()
const PORT = 3000

const SUPPORTED_CARRIERS = {
  nova_poshta: 'Nova Poshta',
  ukrposhta: 'Ukrposhta',
  meest: 'Meest',
}
const DELIVERY_PROTECTION_MS = 48 * 60 * 60 * 1000

const USER_PRODUCTS_FILE = path.join(__dirname, 'user-products.json')
const CHAT_MESSAGES_FILE = path.join(
  __dirname,
  'chat-messages.json'
)

const ORDERS_FILE = path.join(
  __dirname,
  'orders.json'
)

const REWARDS_FILE = path.join(
  __dirname,
  'rewards.json'
)

const UPLOADS_DIR = path.join(__dirname, 'uploads')

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

function loadUserProducts() {
  try {
    if (!fs.existsSync(USER_PRODUCTS_FILE)) {
      fs.writeFileSync(USER_PRODUCTS_FILE, '[]', 'utf8')
      return []
    }

    const raw = fs
      .readFileSync(USER_PRODUCTS_FILE, 'utf8')
      .replace(/^\uFEFF/, '')
      .trim()

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Could not load user-products.json:', error)
    return []
  }
}

function loadChatMessages() {
  try {
    if (!fs.existsSync(CHAT_MESSAGES_FILE)) {
      fs.writeFileSync(
        CHAT_MESSAGES_FILE,
        '[]',
        'utf8'
      )

      return []
    }

    const raw = fs
      .readFileSync(CHAT_MESSAGES_FILE, 'utf8')
      .replace(/^\uFEFF/, '')
      .trim()

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)

    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error(
      'Could not load chat-messages.json:',
      error
    )

    return []
  }
}

function loadOrders() {
  try {
    if (!fs.existsSync(ORDERS_FILE)) {
      fs.writeFileSync(
        ORDERS_FILE,
        '[]',
        'utf8'
      )

      return []
    }

    const raw = fs
      .readFileSync(ORDERS_FILE, 'utf8')
      .replace(/^\uFEFF/, '')
      .trim()

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)

    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error(
      'Could not load orders.json:',
      error
    )

    return []
  }
}
function loadRewards() {
  try {
    if (!fs.existsSync(REWARDS_FILE)) {
      fs.writeFileSync(
        REWARDS_FILE,
        '[]',
        'utf8'
      )

      return []
    }

    const raw = fs
      .readFileSync(REWARDS_FILE, 'utf8')
      .replace(/^\uFEFF/, '')
      .trim()

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)

    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error(
      'Could not load rewards.json:',
      error
    )

    return []
  }
}

function saveOrders() {
  fs.writeFileSync(
    ORDERS_FILE,
    JSON.stringify(orders, null, 2),
    'utf8'
  )
}

function saveRewards() {
  fs.writeFileSync(
    REWARDS_FILE,
    JSON.stringify(rewards, null, 2),
    'utf8'
  )
}

function saveChatMessages() {
  fs.writeFileSync(
    CHAT_MESSAGES_FILE,
    JSON.stringify(chatMessages, null, 2),
    'utf8'
  )
}
function saveUserProducts() {
  fs.writeFileSync(
    USER_PRODUCTS_FILE,
    JSON.stringify(userProducts, null, 2),
    'utf8'
  )
}

const userProducts = loadUserProducts()
const chatMessages = loadChatMessages()
const orders = loadOrders()
const rewards = loadRewards()

function isBoostActive(product) {
  if (!product?.boostedUntil) {
    return false
  }

  const boostedUntil =
    new Date(product.boostedUntil).getTime()

  return (
    Number.isFinite(boostedUntil) &&
    boostedUntil > Date.now() &&
    (product.status || 'active') === 'active'
  )
}

function getAllProducts() {
  return [...userProducts, ...products]
    .map((product, index) => ({
      product,
      index,
    }))
    .sort((a, b) => {
      const aBoosted = isBoostActive(a.product)
      const bBoosted = isBoostActive(b.product)

      if (aBoosted !== bBoosted) {
        return aBoosted ? -1 : 1
      }

      if (aBoosted && bBoosted) {
        const aTime =
          new Date(a.product.boostedAt || 0).getTime()
        const bTime =
          new Date(b.product.boostedAt || 0).getTime()

        if (aTime !== bTime) {
          return bTime - aTime
        }
      }

      return a.index - b.index
    })
    .map(({ product }) => product)
}

function isSkrPayment(order) {
  return (
    typeof order?.paymentMethod === 'string' &&
    order.paymentMethod
      .trim()
      .toUpperCase()
      .includes('SKR')
  )
}

function isRewardableBuyer(order) {
  return (
    typeof order?.buyer === 'string' &&
    order.buyer.trim() &&
    order.buyer !== 'TEFTE buyer'
  )
}

function getRewardAccount(wallet) {
  return rewards.find(
    (item) => item.wallet === wallet
  )
}

function getOrCreateRewardAccount(wallet) {
  let account = getRewardAccount(wallet)

  if (account) {
    if (!Array.isArray(account.rewardedOrderIds)) {
      account.rewardedOrderIds = []
    }

    if (!Array.isArray(account.history)) {
      account.history = []
    }

    account.xp = Number(account.xp) || 0
    account.listingBoosts =
      Number(account.listingBoosts) || 0
    account.completedSkrPurchases =
      Number(account.completedSkrPurchases) || 0

    return account
  }

  account = {
    wallet,
    xp: 0,
    listingBoosts: 0,
    completedSkrPurchases: 0,
    rewardedOrderIds: [],
    history: [],
    updatedAt: new Date().toISOString(),
  }

  rewards.push(account)

  return account
}

function calculateSkrReward(order, account) {
  const isFirstPurchase =
    account.completedSkrPurchases === 0

  if (isFirstPurchase) {
    return {
      xpAwarded: 100,
      listingBoostsAwarded: 1,
      baseXp: 100,
      spendBonusXp: 0,
    }
  }

  const isUsdc =
    typeof order.productCurrency === 'string' &&
    order.productCurrency
      .trim()
      .toUpperCase() === 'USDC'

  const orderValueUsd = isUsdc
    ? Math.max(
        0,
        Number(order.productPrice) || 0
      )
    : 0

  const spendBonusXp = Math.min(
    30,
    Math.floor(orderValueUsd)
  )

  return {
    xpAwarded: 20 + spendBonusXp,
    listingBoostsAwarded: 0,
    baseXp: 20,
    spendBonusXp,
  }
}

function applySkrReward(order, shouldSave = true) {
  if (
    order?.status !== 'completed' ||
    !isSkrPayment(order) ||
    !isRewardableBuyer(order)
  ) {
    return null
  }

  const account =
    getOrCreateRewardAccount(order.buyer)

  if (
    account.rewardedOrderIds.includes(
      order.id
    )
  ) {
    const previousReward =
      account.history.find(
        (item) =>
          item.orderId === order.id
      ) || null

    return {
      alreadyRewarded: true,
      account,
      reward: previousReward,
    }
  }

  const calculated =
    calculateSkrReward(order, account)

  const now = new Date().toISOString()

  const reward = {
    orderId: order.id,
    xpAwarded: calculated.xpAwarded,
    listingBoostsAwarded:
      calculated.listingBoostsAwarded,
    baseXp: calculated.baseXp,
    spendBonusXp:
      calculated.spendBonusXp,
    productPrice:
      Number(order.productPrice) || 0,
    productCurrency:
      order.productCurrency || 'USDC',
    awardedAt: now,
  }

  account.xp += reward.xpAwarded
  account.listingBoosts +=
    reward.listingBoostsAwarded
  account.completedSkrPurchases += 1
  account.rewardedOrderIds.push(order.id)
  account.history.push(reward)
  account.updatedAt = now

  if (shouldSave) {
    saveRewards()
  }

  return {
    alreadyRewarded: false,
    account,
    reward,
  }
}

function syncCompletedSkrRewards(
  wallet = null
) {
  const completedOrders = orders
    .filter(
      (order) =>
        order.status === 'completed' &&
        isSkrPayment(order) &&
        isRewardableBuyer(order) &&
        (!wallet || order.buyer === wallet)
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime()
    )

  let changed = false

  for (const order of completedOrders) {
    const account =
      getOrCreateRewardAccount(order.buyer)

    if (
      account.rewardedOrderIds.includes(
        order.id
      )
    ) {
      continue
    }

    applySkrReward(order, false)
    changed = true
  }

  if (changed) {
    saveRewards()
  }

  return changed
}

// Backfill any completed SKR orders that existed before rewards.json.
syncCompletedSkrRewards()

function getRewardForOrder(order) {
  if (!order || !isRewardableBuyer(order)) {
    return null
  }

  const account =
    getRewardAccount(order.buyer)

  if (!account || !Array.isArray(account.history)) {
    return null
  }

  return (
    account.history.find(
      (item) => item.orderId === order.id
    ) || null
  )
}

function finalizeOrder(
  order,
  completionReason = 'buyer_confirmed'
) {
  if (!order) {
    return null
  }

  if (order.status === 'completed') {
    return {
      order,
      reward: getRewardForOrder(order),
      rewards:
        isRewardableBuyer(order)
          ? getRewardAccount(order.buyer)
          : null,
    }
  }

  order.status = 'completed'
  order.completedAt =
    new Date().toISOString()
  order.completionReason =
    completionReason
  order.updatedAt =
    order.completedAt

  saveOrders()

  const rewardResult =
    applySkrReward(order)

  console.log(
    'TEFTE order completed:',
    order.id,
    completionReason
  )

  if (
    rewardResult &&
    !rewardResult.alreadyRewarded
  ) {
    console.log(
      'TEFTE SKR reward:',
      order.buyer,
      `+${rewardResult.reward.xpAwarded} XP`,
      `+${rewardResult.reward.listingBoostsAwarded} boost`
    )
  }

  return {
    order,
    reward:
      rewardResult?.reward ||
      getRewardForOrder(order),
    rewards:
      rewardResult?.account ||
      (isRewardableBuyer(order)
        ? getRewardAccount(order.buyer)
        : null),
  }
}

function processAutoCompletions() {
  const now = Date.now()
  let completedCount = 0

  for (const order of orders) {
    if (
      order.status !== 'delivered' ||
      !order.protectionEndsAt
    ) {
      continue
    }

    const protectionEndsAt =
      new Date(
        order.protectionEndsAt
      ).getTime()

    if (
      !Number.isFinite(protectionEndsAt) ||
      protectionEndsAt > now
    ) {
      continue
    }

    finalizeOrder(
      order,
      'auto_completed_after_48h'
    )

    completedCount += 1
  }

  if (completedCount > 0) {
    console.log(
      `TEFTE auto-completed ${completedCount} delivered order(s)`
    )
  }

  return completedCount
}

processAutoCompletions()

const autoCompleteTimer = setInterval(
  () => {
    try {
      processAutoCompletions()
    } catch (error) {
      console.error(
        'TEFTE auto-complete error:',
        error
      )
    }
  },
  60 * 1000
)

if (
  typeof autoCompleteTimer.unref ===
  'function'
) {
  autoCompleteTimer.unref()
}

app.use(express.json())

app.use('/uploads', express.static(UPLOADS_DIR))

// AI image analysis:
// the image stays in memory and is sent to the vision model.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
})

// Published listing images:
// these are saved to server/uploads.
const listingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR)
  },

  filename: (req, file, cb) => {
    const extension = file.originalname.includes('.')
      ? file.originalname.substring(
          file.originalname.lastIndexOf('.')
        )
      : '.jpg'

    cb(null, `listing-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`)
  },
})

const uploadListing = multer({
  storage: listingStorage,
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

// Get messages for a TEFTE chat.
app.get('/api/chats/:chatId/messages', (req, res) => {
  const messages = chatMessages.filter(
    (message) => message.chatId === req.params.chatId
  )

  res.json({
    messages,
  })
})
// Add a message to a TEFTE chat.
app.post('/api/chats/:chatId/messages', (req, res) => {
  const { text, sender } = req.body

  if (
    typeof text !== 'string' ||
    !text.trim()
  ) {
    return res.status(400).json({
      error: 'Message text is required.',
    })
  }

  const message = {
    id: `message-${Date.now()}`,
    chatId: req.params.chatId,
    text: text.trim(),
    sender:
      typeof sender === 'string' &&
      sender.trim()
        ? sender.trim()
        : 'me',
    time: new Date().toISOString(),
  }

  chatMessages.push(message)

  try {
    saveChatMessages()
  } catch (error) {
    chatMessages.pop()

    console.error(
      'Could not save TEFTE chat message:',
      error
    )

    return res.status(500).json({
      error: 'Could not save the message.',
    })
  }

  res.status(201).json({
    message: 'Message sent successfully.',
    data: message,
  })
})
// Edit a TEFTE chat message.
app.patch('/api/chats/:chatId/messages/:messageId', (req, res) => {
  const { text } = req.body

  if (
    typeof text !== 'string' ||
    !text.trim()
  ) {
    return res.status(400).json({
      error: 'Message text is required.',
    })
  }

  const messageIndex = chatMessages.findIndex(
    (message) =>
      message.chatId === req.params.chatId &&
      message.id === req.params.messageId
  )

  if (messageIndex === -1) {
    return res.status(404).json({
      error: 'Message not found.',
    })
  }

  const previousMessage = {
    ...chatMessages[messageIndex],
  }

  chatMessages[messageIndex] = {
    ...chatMessages[messageIndex],
    text: text.trim(),
    edited: true,
  }

  try {
    saveChatMessages()
  } catch (error) {
    chatMessages[messageIndex] = previousMessage

    console.error(
      'Could not edit TEFTE chat message:',
      error
    )

    return res.status(500).json({
      error: 'Could not edit the message.',
    })
  }

  res.json({
    message: 'Message edited successfully.',
    data: chatMessages[messageIndex],
  })
})

// Delete a TEFTE chat message.
app.delete('/api/chats/:chatId/messages/:messageId', (req, res) => {
  const messageIndex = chatMessages.findIndex(
    (message) =>
      message.chatId === req.params.chatId &&
      message.id === req.params.messageId
  )

  if (messageIndex === -1) {
    return res.status(404).json({
      error: 'Message not found.',
    })
  }

  const deletedMessage = chatMessages[messageIndex]

  chatMessages.splice(messageIndex, 1)

  try {
    saveChatMessages()
  } catch (error) {
    chatMessages.splice(
      messageIndex,
      0,
      deletedMessage
    )

    console.error(
      'Could not delete TEFTE chat message:',
      error
    )

    return res.status(500).json({
      error: 'Could not delete the message.',
    })
  }

  res.json({
    message: 'Message deleted successfully.',
    data: deletedMessage,
  })
})
app.get('/api/products', (req, res) => {
  res.json(getAllProducts())
})

// Publish a marketplace listing.
// Accepts multipart/form-data with an optional "image" file.
app.post(
  '/api/products',
  uploadListing.array('images', 8),
  (req, res) => {
    const {
      title,
      category,
      condition,
      description,
      price,
    } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({
        error: 'Product title is required.',
      })
    }

    const numericPrice = Number(price)

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice < 0
    ) {
      return res.status(400).json({
        error: 'Valid product price is required.',
      })
    }

    const newProduct = {
      id: `user-${Date.now()}`,

      title: title.trim(),

      category:
        typeof category === 'string' &&
        category.trim()
          ? category.trim()
          : 'Other',

      price: numericPrice,

      currency: 'USDC',

      description:
        typeof description === 'string'
          ? description.trim()
          : '',

      condition:
        typeof condition === 'string' &&
        condition.trim()
          ? condition.trim()
          : 'Good',

      seller: 'crypton.skr',

      userListing: true,

      imageUrls: Array.isArray(req.files)
        ? req.files.map(
            (file) => `/uploads/${file.filename}`
          )
        : [],

      imageUrl:
        Array.isArray(req.files) && req.files[0]
          ? `/uploads/${req.files[0].filename}`
          : null,
    }

    userProducts.unshift(newProduct)

    try {
      saveUserProducts()
    } catch (error) {
      userProducts.shift()

      console.error(
        'Could not save TEFTE listing:',
        error
      )

      return res.status(500).json({
        error: 'Could not save the listing.',
      })
    }

    console.log(
      'TEFTE listing published:',
      newProduct
    )

    res.status(201).json({
      message: 'Listing published successfully.',
      product: newProduct,
    })
  }
)

// Update a TEFTE user listing.
app.patch(
  '/api/products/:id',
  uploadListing.array('images', 8),
  (req, res) => {
  const index = userProducts.findIndex(
    (product) => product.id === req.params.id
  )

  if (index === -1) {
    return res.status(404).json({
      error: 'Listing not found.',
    })
  }

  const product = userProducts[index]

  const {
    title,
    category,
    condition,
    description,
    price,
    status,
  } = req.body

  if (typeof title === 'string' && title.trim()) {
    product.title = title.trim()
  }

  if (typeof category === 'string' && category.trim()) {
    product.category = category.trim()
  }

  if (typeof condition === 'string' && condition.trim()) {
    product.condition = condition.trim()
  }

  if (typeof description === 'string') {
    product.description = description.trim()
  }

  if (price !== undefined) {
    const numericPrice = Number(price)

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        error: 'Valid product price is required.',
      })
    }

    product.price = numericPrice
  }

  if (status !== undefined) {
    if (!['active', 'sold'].includes(status)) {
      return res.status(400).json({
        error: 'Status must be active or sold.',
      })
    }

    product.status = status
  }

  // Photo editing.
  // existingImages contains the old photos that the app wants to keep,
  // already arranged in the desired order.
  if (req.body.existingImages !== undefined || (req.files && req.files.length)) {
    let existingImages = []

    if (req.body.existingImages) {
      try {
        const parsedImages = JSON.parse(req.body.existingImages)

        if (Array.isArray(parsedImages)) {
          existingImages = parsedImages.filter(
            (image) =>
              typeof image === 'string' &&
              image.startsWith('/uploads/')
          )
        }
      } catch (error) {
        return res.status(400).json({
          error: 'Invalid existingImages data.',
        })
      }
    }

    const newImages = Array.isArray(req.files)
      ? req.files.map(
          (file) => `/uploads/${file.filename}`
        )
      : []

    const imageUrls = [
      ...existingImages,
      ...newImages,
    ].slice(0, 8)

    if (imageUrls.length === 0) {
      return res.status(400).json({
        error: 'A listing must have at least one photo.',
      })
    }

    product.imageUrls = imageUrls
    product.imageUrl = imageUrls[0]
  }

  try {
    saveUserProducts()
  } catch (error) {
    console.error('Could not update TEFTE listing:', error)

    return res.status(500).json({
      error: 'Could not update the listing.',
    })
  }

  res.json({
    message: 'Listing updated successfully.',
    product,
  })
  }
)

// Spend one Listing Boost on a specific active listing.
// One boost keeps the listing promoted for 24 hours.
app.post('/api/products/:id/boost', (req, res) => {
  try {
    const product = userProducts.find(
      (item) => item.id === req.params.id
    )

    if (!product) {
      return res.status(404).json({
        error: 'Listing not found.',
      })
    }

    const wallet =
      typeof req.body?.wallet === 'string'
        ? req.body.wallet.trim()
        : ''

    if (!wallet) {
      return res.status(400).json({
        error: 'Wallet is required.',
      })
    }

    const status =
      product.status || 'active'

    if (status !== 'active') {
      return res.status(409).json({
        error:
          'Only an active listing can be boosted.',
      })
    }

    if (isBoostActive(product)) {
      return res.status(409).json({
        error:
          'This listing already has an active boost.',
        boostedUntil: product.boostedUntil,
      })
    }

    const account =
      getRewardAccount(wallet)

    if (
      !account ||
      (Number(account.listingBoosts) || 0) < 1
    ) {
      return res.status(409).json({
        error:
          'You do not have an available Listing Boost.',
      })
    }

    const previousBoosts =
      Number(account.listingBoosts) || 0

    const previousProductBoost = {
      boostedAt: product.boostedAt,
      boostedUntil: product.boostedUntil,
      boostedBy: product.boostedBy,
    }

    const now = new Date()
    const boostedUntil =
      new Date(
        now.getTime() + 24 * 60 * 60 * 1000
      )

    account.listingBoosts =
      previousBoosts - 1
    account.updatedAt =
      now.toISOString()

    product.boostedAt =
      now.toISOString()
    product.boostedUntil =
      boostedUntil.toISOString()
    product.boostedBy = wallet

    try {
      saveRewards()
      saveUserProducts()
    } catch (error) {
      account.listingBoosts =
        previousBoosts

      product.boostedAt =
        previousProductBoost.boostedAt
      product.boostedUntil =
        previousProductBoost.boostedUntil
      product.boostedBy =
        previousProductBoost.boostedBy

      try {
        saveRewards()
        saveUserProducts()
      } catch (rollbackError) {
        console.error(
          'TEFTE boost rollback error:',
          rollbackError
        )
      }

      throw error
    }

    console.log(
      'TEFTE listing boosted:',
      product.id,
      'until',
      product.boostedUntil
    )

    res.json({
      message:
        'Listing boosted for 24 hours.',
      product,
      rewards: account,
    })
  } catch (error) {
    console.error(
      'Could not boost TEFTE listing:',
      error
    )

    res.status(500).json({
      error: 'Could not boost listing.',
    })
  }
})

// Delete a TEFTE user listing.
app.delete('/api/products/:id', (req, res) => {
  const index = userProducts.findIndex(
    (product) => product.id === req.params.id
  )

  if (index === -1) {
    return res.status(404).json({
      error: 'Listing not found.',
    })
  }

  const [deletedProduct] = userProducts.splice(index, 1)

  try {
    saveUserProducts()
  } catch (error) {
    userProducts.splice(index, 0, deletedProduct)

    console.error('Could not delete TEFTE listing:', error)

    return res.status(500).json({
      error: 'Could not delete the listing.',
    })
  }

  res.json({
    message: 'Listing deleted successfully.',
    product: deletedProduct,
  })
})
// Ask TEFTE AI product search.
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
${JSON.stringify(getAllProducts(), null, 2)}
              `,
            },
          ],
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error(
        'OpenRouter error:',
        data
      )

      return res
        .status(response.status)
        .json({
          error:
            'TEFTE AI could not process the request.',
        })
    }

    const content =
      data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error(
        'AI returned an empty response'
      )
    }

    const cleanedContent = content
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim()

    const aiResult =
      JSON.parse(cleanedContent)

    const requestedIds =
      Array.isArray(aiResult.productIds)
        ? aiResult.productIds
        : []

    const allProducts =
      getAllProducts()

    const matchedProducts =
      requestedIds
        .map((id) =>
          allProducts.find(
            (product) =>
              product.id === id
          )
        )
        .filter(Boolean)
        .slice(0, 3)

    res.json({
      summary:
        typeof aiResult.summary ===
        'string'
          ? aiResult.summary
          : '',

      products: matchedProducts,
    })
  } catch (error) {
    console.error(
      'Search error:',
      error
    )

    res.status(500).json({
      error:
        'TEFTE AI could not process the request.',
    })
  }
})

// Analyze a product photo with TEFTE AI.
app.post(
  '/api/analyze-product',
  upload.single('image'),

  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error:
          'Product image is required.',
      })
    }

    try {
      const mimeType =
        req.file.mimetype ||
        'image/jpeg'

      const base64Image =
        req.file.buffer.toString(
          'base64'
        )

      const dataUrl =
        `data:${mimeType};base64,${base64Image}`

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
            Authorization:
              `Bearer ${process.env.OPENROUTER_API_KEY}`,

            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            model:
              'openrouter/free',

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

                    text:
                      'Create a TEFTE marketplace listing draft for the main item in this photo.',
                  },

                  {
                    type:
                      'image_url',

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

      const data =
        await response.json()

      if (!response.ok) {
        console.error(
          'OpenRouter vision error:',
          data
        )

        return res
          .status(response.status)
          .json({
            error:
              'TEFTE AI could not analyze the image.',
          })
      }

      const content =
        data.choices?.[0]
          ?.message?.content

      if (!content) {
        throw new Error(
          'Vision AI returned an empty response'
        )
      }

      const cleanedContent =
        content
          .replace(
            /```json/gi,
            ''
          )
          .replace(/```/g, '')
          .trim()

      const jsonStart =
        cleanedContent.indexOf('{')

      const jsonEnd =
        cleanedContent.lastIndexOf('}')

      if (
        jsonStart === -1 ||
        jsonEnd === -1 ||
        jsonEnd <= jsonStart
      ) {
        throw new Error(
          'Vision AI response did not contain valid JSON'
        )
      }

      const jsonContent =
        cleanedContent.slice(
          jsonStart,
          jsonEnd + 1
        )

      const aiResult =
        JSON.parse(
          jsonContent
        )
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

      const suggestedPrice =
        Number(
          aiResult.suggestedPrice
        )

      const listing = {
        title:
          typeof aiResult.title ===
          'string'
            ? aiResult.title.trim()
            : 'Untitled item',

        category:
          allowedCategories.includes(
            aiResult.category
          )
            ? aiResult.category
            : 'Other',

        condition:
          allowedConditions.includes(
            aiResult.condition
          )
            ? aiResult.condition
            : 'Good',

        description:
          typeof aiResult.description ===
          'string'
            ? aiResult.description.trim()
            : '',

        suggestedPrice:
          Number.isFinite(
            suggestedPrice
          ) &&
          suggestedPrice >= 0
            ? suggestedPrice
            : 0,
      }

      console.log(
        'TEFTE AI listing:',
        listing
      )

      res.json({
        listing,
      })
    } catch (error) {
      console.error(
        'Vision analysis error:',
        error
      )

      res.status(500).json({
        error:
          'TEFTE AI could not analyze the image.',
      })
    }
  }
)

// Create a new marketplace order after payment.
app.post('/api/orders', (req, res) => {
  try {
    const {
      productId,
      buyer,
      seller,
      paymentMethod,
      transactionSignature,
    } = req.body

    if (!productId) {
      return res.status(400).json({
        error: 'productId is required',
      })
    }

    const product = getAllProducts().find(
      (item) => item.id === productId
    )

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
      })
    }

    const now = new Date().toISOString()

    const order = {
      id: `order-${Date.now()}`,
      productId: product.id,
      productTitle: product.title,
      productPrice: product.price,
      productCurrency: product.currency,
      buyer: buyer || 'TEFTE buyer',
      seller:
        seller ||
        product.seller ||
        'TEFTE seller',
      paymentMethod:
        paymentMethod || 'SOL',
      transactionSignature:
        transactionSignature || null,
      status: 'waiting_seller',
      carrier: null,
      carrierStatus: null,
      trackingNumber: null,
      trackingVerifiedAt: null,
      shippedAt: null,
      deliveredAt: null,
      protectionEndsAt: null,
      disputedAt: null,
      disputeReason: null,
      completedAt: null,
      completionReason: null,
      createdAt: now,
      updatedAt: now,
    }

    orders.unshift(order)
    saveOrders()

    console.log(
      'TEFTE order created:',
      order.id,
      order.status
    )

    res.status(201).json({
      order,
    })
  } catch (error) {
    console.error(
      'Could not create TEFTE order:',
      error
    )

    res.status(500).json({
      error: 'Could not create order',
    })
  }
})
// Seller confirms or declines a waiting order.
app.patch('/api/orders/:orderId/seller-decision', (req, res) => {
  try {
    const { orderId } = req.params
    const { decision } = req.body

    const order = orders.find(
      (item) => item.id === orderId
    )

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
      })
    }

    if (order.status !== 'waiting_seller') {
      return res.status(409).json({
        error:
          'Seller decision is no longer available for this order',
      })
    }

    if (
      decision !== 'confirm' &&
      decision !== 'decline'
    ) {
      return res.status(400).json({
        error:
          'decision must be confirm or decline',
      })
    }

    order.status =
      decision === 'confirm'
        ? 'confirmed'
        : 'declined_by_seller'

    order.updatedAt =
      new Date().toISOString()

    saveOrders()

    console.log(
      'TEFTE seller decision:',
      order.id,
      order.status
    )

    res.json({
      order,
    })
  } catch (error) {
    console.error(
      'Could not update seller decision:',
      error
    )

    res.status(500).json({
      error:
        'Could not update seller decision',
    })
  }
})
// Seller can mark an accepted order as shipped.
// For the MVP the seller must choose a carrier and enter a tracking number.
// Real carrier API verification is added later.
app.patch('/api/orders/:orderId/seller-ship', (req, res) => {
  try {
    const { orderId } = req.params
    const {
      carrier,
      trackingNumber,
    } = req.body || {}

    const order = orders.find(
      (item) => item.id === orderId
    )

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
      })
    }

    if (order.status !== 'confirmed') {
      return res.status(409).json({
        error:
          'Only a confirmed order can be marked as shipped',
      })
    }

    if (
      typeof carrier !== 'string' ||
      !SUPPORTED_CARRIERS[carrier]
    ) {
      return res.status(400).json({
        error:
          'Choose a supported delivery carrier.',
      })
    }

    const cleanTrackingNumber =
      typeof trackingNumber === 'string'
        ? trackingNumber.trim()
        : ''

    if (
      cleanTrackingNumber.length < 5 ||
      cleanTrackingNumber.length > 64
    ) {
      return res.status(400).json({
        error:
          'Enter a valid tracking number.',
      })
    }

    const now = new Date().toISOString()

    order.status = 'shipped'
    order.carrier = carrier
    order.carrierStatus = 'shipped'
    order.trackingNumber =
      cleanTrackingNumber
    order.trackingVerifiedAt = null
    order.shippedAt = now
    order.updatedAt = now

    saveOrders()

    console.log(
      'TEFTE order shipped:',
      order.id,
      SUPPORTED_CARRIERS[carrier],
      cleanTrackingNumber
    )

    res.json({
      order,
    })
  } catch (error) {
    console.error(
      'Could not mark TEFTE order as shipped:',
      error
    )

    res.status(500).json({
      error: 'Could not mark order as shipped',
    })
  }
})

// Delivery confirmation from a carrier/backend integration.
// IMPORTANT: this endpoint is not exposed in the mobile UI.
// In production it should be called only by a trusted carrier webhook/backend.
app.patch('/api/orders/:orderId/delivery-confirmed', (req, res) => {
  try {
    const { orderId } = req.params
    const { source } = req.body || {}

    const order = orders.find(
      (item) => item.id === orderId
    )

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
      })
    }

    if (order.status !== 'shipped') {
      return res.status(409).json({
        error:
          'Only a shipped order can be marked as delivered',
      })
    }

    if (
      !order.carrier ||
      !order.trackingNumber
    ) {
      return res.status(409).json({
        error:
          'Carrier and tracking number are required before delivery confirmation.',
      })
    }

    if (
      source !== 'carrier' &&
      source !== 'carrier-demo'
    ) {
      return res.status(400).json({
        error:
          'A trusted carrier source is required',
      })
    }

    const deliveredAt = new Date()
    const protectionEndsAt =
      new Date(
        deliveredAt.getTime() +
          DELIVERY_PROTECTION_MS
      )

    order.status = 'delivered'
    order.carrierStatus = 'delivered'
    order.trackingVerifiedAt =
      deliveredAt.toISOString()
    order.deliveredAt =
      deliveredAt.toISOString()
    order.protectionEndsAt =
      protectionEndsAt.toISOString()
    order.updatedAt =
      order.deliveredAt

    saveOrders()

    console.log(
      'TEFTE delivery confirmed:',
      order.id,
      'protection until',
      order.protectionEndsAt
    )

    res.json({
      order,
    })
  } catch (error) {
    console.error(
      'Could not confirm TEFTE delivery:',
      error
    )

    res.status(500).json({
      error: 'Could not confirm delivery',
    })
  }
})

// Buyer can confirm a carrier-delivered order immediately.
// This completes the order before the 48-hour timer expires.
app.patch('/api/orders/:orderId/buyer-confirm', (req, res) => {
  try {
    processAutoCompletions()

    const { orderId } = req.params

    const order = orders.find(
      (item) => item.id === orderId
    )

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
      })
    }

    if (order.status === 'completed') {
      const result =
        finalizeOrder(order)

      return res.json(result)
    }

    if (order.status !== 'delivered') {
      return res.status(409).json({
        error:
          'Only a delivered order can be confirmed by the buyer',
      })
    }

    const result =
      finalizeOrder(
        order,
        'buyer_confirmed'
      )

    res.json(result)
  } catch (error) {
    console.error(
      'Could not confirm TEFTE order:',
      error
    )

    res.status(500).json({
      error: 'Could not confirm order',
    })
  }
})

// Buyer can open a dispute during the 48-hour protection window.
// A disputed order never auto-completes until a future dispute-resolution flow decides it.
app.patch('/api/orders/:orderId/buyer-dispute', (req, res) => {
  try {
    processAutoCompletions()

    const { orderId } = req.params
    const { reason } = req.body || {}

    const order = orders.find(
      (item) => item.id === orderId
    )

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
      })
    }

    if (order.status !== 'delivered') {
      return res.status(409).json({
        error:
          'A dispute can only be opened for a delivered order during the protection window',
      })
    }

    const protectionEndsAt =
      new Date(
        order.protectionEndsAt || 0
      ).getTime()

    if (
      !Number.isFinite(protectionEndsAt) ||
      protectionEndsAt <= Date.now()
    ) {
      processAutoCompletions()

      return res.status(409).json({
        error:
          'The 48-hour protection window has ended',
      })
    }

    const now = new Date().toISOString()

    order.status = 'disputed'
    order.disputedAt = now
    order.disputeReason =
      typeof reason === 'string' &&
      reason.trim()
        ? reason.trim()
        : 'Buyer opened a dispute'
    order.updatedAt = now

    saveOrders()

    console.log(
      'TEFTE dispute opened:',
      order.id
    )

    res.json({
      order,
    })
  } catch (error) {
    console.error(
      'Could not open TEFTE dispute:',
      error
    )

    res.status(500).json({
      error: 'Could not open dispute',
    })
  }
})

// Legacy endpoint kept temporarily for older clients.
// New clients use /buyer-confirm after carrier delivery confirmation.
app.patch('/api/orders/:orderId/complete', (req, res) => {
  try {
    processAutoCompletions()

    const { orderId } = req.params

    const order = orders.find(
      (item) => item.id === orderId
    )

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
      })
    }

    if (order.status === 'completed') {
      return res.json(
        finalizeOrder(order)
      )
    }

    if (
      order.status !== 'delivered' &&
      order.status !== 'received'
    ) {
      return res.status(409).json({
        error:
          'Only a delivered order can be completed',
      })
    }

    if (order.status === 'received') {
      order.status = 'delivered'
      order.deliveredAt =
        order.updatedAt ||
        new Date().toISOString()
      order.protectionEndsAt =
        new Date(
          new Date(
            order.deliveredAt
          ).getTime() +
            DELIVERY_PROTECTION_MS
        ).toISOString()
    }

    const result =
      finalizeOrder(
        order,
        'legacy_manual_complete'
      )

    res.json(result)
  } catch (error) {
    console.error(
      'Could not complete TEFTE order:',
      error
    )

    res.status(500).json({
      error: 'Could not complete order',
    })
  }
})

// Buyer can cancel only before seller confirmation.
app.patch('/api/orders/:orderId/buyer-cancel', (req, res) => {
  try {
    const { orderId } = req.params

    const order = orders.find(
      (item) => item.id === orderId
    )

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
      })
    }

    if (order.status !== 'waiting_seller') {
      return res.status(409).json({
        error:
          'This order can no longer be cancelled by the buyer',
      })
    }

    order.status = 'cancelled_by_buyer'
    order.updatedAt =
      new Date().toISOString()

    saveOrders()

    console.log(
      'TEFTE buyer cancelled:',
      order.id
    )

    res.json({
      order,
    })
  } catch (error) {
    console.error(
      'Could not cancel TEFTE order:',
      error
    )

    res.status(500).json({
      error: 'Could not cancel order',
    })
  }
})
// Get persisted TEFTE rewards for one wallet.
app.get('/api/rewards/:wallet', (req, res) => {
  try {
    const wallet =
      typeof req.params.wallet === 'string'
        ? req.params.wallet.trim()
        : ''

    if (!wallet) {
      return res.status(400).json({
        error: 'Wallet is required',
      })
    }

    // Repairs any completed SKR order that has not been recorded
    // in rewards.json yet.
    syncCompletedSkrRewards(wallet)

    const account =
      getRewardAccount(wallet)

    res.json({
      rewards:
        account || {
          wallet,
          xp: 0,
          listingBoosts: 0,
          completedSkrPurchases: 0,
          rewardedOrderIds: [],
          history: [],
          updatedAt: null,
        },
    })
  } catch (error) {
    console.error(
      'Could not load TEFTE rewards:',
      error
    )

    res.status(500).json({
      error: 'Could not load rewards',
    })
  }
})

// Get all marketplace orders.
app.get('/api/orders', (req, res) => {
  try {
    processAutoCompletions()

    res.json({
      orders,
    })
  } catch (error) {
    console.error(
      'TEFTE get orders error:',
      error
    )

    res.status(500).json({
      error: 'Could not load orders',
    })
  }
})
// Get one marketplace order.
app.get('/api/orders/:orderId', (req, res) => {
  try {
    processAutoCompletions()

    const { orderId } = req.params

    const order = orders.find(
      (item) => item.id === orderId
    )

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
      })
    }

    res.json({
      order,
      reward:
        getRewardForOrder(order),
    })
  } catch (error) {
    console.error(
      'Could not load TEFTE order:',
      error
    )

    res.status(500).json({
      error: 'Could not load order',
    })
  }
})
app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `TEFTE AI server running on port ${PORT}`
    )

    console.log(
      `Loaded ${products.length} products`
    )

    console.log(
      `Loaded ${orders.length} orders`
    )

    console.log(
      `Loaded ${rewards.length} reward accounts`
    )
  }
)




















