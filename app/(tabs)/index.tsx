import React, { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useMobileWallet } from '@wallet-ui/react-native-kit'

const API_URL = 'http://192.168.68.53:3000'

type Product = {
  id: string
  title: string
  category: string
  price: number
  currency: string
  description: string
  weightKg?: number
  condition: string
  imageUrl?: string | null
  imageUrls?: string[]
}

const quickCategories = [
  'Electronics',
  'Home',
  'Fashion',
  'Sports',
  'Outdoor',
  'Vehicles',
  'Gaming',
  'Collectibles',
]

export default function HomeScreen() {
  const { account, connect } = useMobileWallet()
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [summary, setSummary] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [recommended, setRecommended] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingRecommended, setLoadingRecommended] = useState(false)
  const [error, setError] = useState('')

  function getProductImage(product: Product) {
    const imagePath =
      Array.isArray(product.imageUrls) && product.imageUrls.length > 0
        ? product.imageUrls[0]
        : product.imageUrl

    if (!imagePath) {
      return null
    }

    if (
      imagePath.startsWith('http://') ||
      imagePath.startsWith('https://')
    ) {
      return imagePath
    }

    return `${API_URL}${imagePath}`
  }

  async function searchProducts(searchQuery: string) {
    const cleanQuery = searchQuery.trim()

    if (!cleanQuery) {
      return
    }

    const response = await fetch(`${API_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: cleanQuery,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong')
    }

    return data
  }

  async function handleSearch(customQuery?: string) {
    const cleanQuery = (customQuery ?? query).trim()

    if (!cleanQuery || loading) {
      return
    }

    try {
      setLoading(true)
      setSummary('')
      setProducts([])
      setError('')

      const data = await searchProducts(cleanQuery)

      setSummary(data?.summary || '')
      setProducts(Array.isArray(data?.products) ? data.products : [])
    } catch (error) {
      console.error(error)
      setError('Could not connect to TEFTE server.')
    } finally {
      setLoading(false)
    }
  }

  async function loadRecommended() {
    try {
      setLoadingRecommended(true)

      const response = await fetch(`${API_URL}/api/products`)

      if (!response.ok) {
        throw new Error('Could not load products')
      }

      const data = await response.json()
      const catalog = Array.isArray(data) ? data : []

      setRecommended(catalog.slice(0, 6))
    } catch (error) {
      console.error('Recommended products error:', error)
      setRecommended([])
    } finally {
      setLoadingRecommended(false)
    }
  }
  useEffect(() => {
    loadRecommended()
  }, [])

  function selectCategory(category: string) {
    setQuery(category)
    handleSearch(category)
  }

  function openProduct(product: Product) {
    router.push({
      pathname: '/product/[id]',
      params: {
        id: product.id,
      },
    })
  }

  function ProductImage({
    product,
    style,
  }: {
    product: Product
    style: any
  }) {
    const imageUri = getProductImage(product)

    if (imageUri) {
      return (
        <Image
          source={{ uri: imageUri }}
          style={style}
          resizeMode="cover"
        />
      )
    }

    return (
      <View style={[style, styles.imagePlaceholder]}>
        <Text style={styles.imagePlaceholderIcon}>TEFTE</Text>
        <Text style={styles.imagePlaceholderText}>No photo yet</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.logo}>TEFTE</Text>

          {account ? (
            <View style={styles.connectedWallet}>
              <View style={styles.statusDot} />
              <Text style={styles.walletText}>{account.label}</Text>
            </View>
          ) : (
            <Pressable style={styles.walletButton} onPress={connect}>
              <Text style={styles.walletButtonText}>Connect wallet</Text>
            </Pressable>
          )}
        </View>

        {/* HERO */}
        <View style={styles.hero}>
          <Text style={styles.title}>What are you looking for?</Text>

          <Text style={styles.subtitle}>
            Tell TEFTE what you want. AI will find the best matches.
          </Text>

          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Find me a lightweight tent under $150..."
            placeholderTextColor="#999999"
            multiline
            returnKeyType="search"
          />

          <Pressable
            style={[
              styles.searchButton,
              (!query.trim() || loading) && styles.searchButtonDisabled,
            ]}
            onPress={() => handleSearch()}
            disabled={!query.trim() || loading}
          >
            <Text style={styles.searchButtonText}>
              {loading ? 'Searching...' : 'Ask TEFTE'}
            </Text>
          </Pressable>
        </View>

        {/* QUICK CATEGORIES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Explore categories</Text>
            <Text style={styles.sectionHint}>AI-powered</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
          >
            {quickCategories.map((category) => (
              <Pressable
                key={category}
                style={styles.categoryChip}
                onPress={() => selectCategory(category)}
              >
                <Text style={styles.categoryChipText}>{category}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* RECOMMENDED */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommended for you</Text>

            {loadingRecommended ? (
              <Text style={styles.sectionHint}>Loading...</Text>
            ) : null}
          </View>

          {recommended.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recommendedList}
            >
              {recommended.map((product, index) => (
                <Pressable
                  key={product.id}
                  style={styles.recommendedCard}
                  onPress={() => openProduct(product)}
                >
                  <View style={styles.recommendedImageWrap}>
                    <ProductImage
                      product={product}
                      style={styles.recommendedImage}
                    />

                    {index === 0 ? (
                      <View style={styles.matchBadge}>
                        <Text style={styles.matchBadgeText}>AI PICK</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.recommendedContent}>
                    <Text style={styles.recommendedCategory}>
                      {product.category}
                    </Text>

                    <Text
                      style={styles.recommendedTitle}
                      numberOfLines={2}
                    >
                      {product.title}
                    </Text>

                    <Text
                      style={styles.recommendedDescription}
                      numberOfLines={2}
                    >
                      {product.description}
                    </Text>

                    <View style={styles.recommendedBottom}>
                      <Text style={styles.recommendedPrice}>
                        {product.price} {product.currency}
                      </Text>

                      <Text style={styles.arrow}>в†’</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : !loadingRecommended ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                Explore the categories or ask TEFTE for something specific.
              </Text>
            </View>
          ) : null}
        </View>

        {/* AI SEARCH RESULT */}
        {summary ? (
          <View style={styles.section}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>TEFTE recommends</Text>
              <Text style={styles.summaryText}>{summary}</Text>
            </View>
          </View>
        ) : null}

        {products.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Best matches</Text>

            <View style={styles.results}>
              {products.map((product, index) => (
                <Pressable
                  key={product.id}
                  style={styles.productCard}
                  onPress={() => openProduct(product)}
                >
                  <View style={styles.productImageWrap}>
                    <ProductImage
                      product={product}
                      style={styles.productImage}
                    />

                    {index === 0 ? (
                      <View style={styles.bestMatchBadge}>
                        <Text style={styles.bestMatchText}>
                          BEST MATCH
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.productContent}>
                    <Text style={styles.productCategory}>
                      {product.category}
                    </Text>

                    <Text style={styles.productTitle}>
                      {product.title}
                    </Text>

                    <Text
                      style={styles.description}
                      numberOfLines={3}
                    >
                      {product.description}
                    </Text>

                    <View style={styles.detailsRow}>
                      {product.weightKg ? (
                        <Text style={styles.detail}>
                          {product.weightKg} kg
                        </Text>
                      ) : null}

                      <Text style={styles.detail}>
                        {product.condition}
                      </Text>
                    </View>

                    <View style={styles.productFooter}>
                      <Text style={styles.price}>
                        {product.price} {product.currency}
                      </Text>

                      <View style={styles.viewButton}>
                        <Text style={styles.viewButtonText}>
                          View product
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {!loading && summary && products.length === 0 ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              No matching products found.
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.caption}>
          AI-powered marketplace on Solana
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },

  container: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 110,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111111',
  },

  connectedWallet: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginRight: 7,
  },

  walletText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
  },

  walletButton: {
    backgroundColor: '#111111',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },

  walletButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  hero: {
    marginTop: 42,
  },

  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111111',
    lineHeight: 41,
  },

  subtitle: {
    fontSize: 15,
    color: '#666666',
    lineHeight: 23,
    marginTop: 10,
    marginBottom: 20,
  },

  searchInput: {
    minHeight: 82,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 18,
    paddingHorizontal: 17,
    paddingVertical: 15,
    fontSize: 16,
    color: '#111111',
    textAlignVertical: 'top',
  },

  searchButton: {
    backgroundColor: '#111111',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },

  searchButtonDisabled: {
    opacity: 0.35,
  },

  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  section: {
    marginTop: 30,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111111',
  },

  sectionHint: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '600',
  },

  categories: {
    gap: 9,
    paddingRight: 20,
  },

  categoryChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },

  categoryChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333333',
  },

  recommendedList: {
    gap: 12,
    paddingRight: 20,
  },

  recommendedCard: {
    width: 245,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 20,
    overflow: 'hidden',
  },

  recommendedImageWrap: {
    width: '100%',
    height: 155,
    position: 'relative',
  },

  recommendedImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EAEAE7',
  },

  recommendedContent: {
    padding: 16,
    minHeight: 180,
  },

  matchBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  matchBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  recommendedCategory: {
    fontSize: 11,
    color: '#888888',
    fontWeight: '700',
    marginBottom: 5,
  },

  recommendedTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    color: '#111111',
  },

  recommendedDescription: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 17,
    color: '#777777',
  },

  recommendedBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 12,
  },

  recommendedPrice: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111111',
  },

  arrow: {
    fontSize: 20,
    color: '#111111',
  },

  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAEAE7',
  },

  imagePlaceholderIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: '#A4A4A0',
    letterSpacing: 1,
  },

  imagePlaceholderText: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: '600',
    color: '#AAAAA6',
  },

  summaryCard: {
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 18,
  },

  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#777777',
    marginBottom: 7,
    textTransform: 'uppercase',
  },

  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333333',
  },

  results: {
    marginTop: 14,
  },

  productCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 20,
    marginBottom: 15,
    overflow: 'hidden',
  },

  productImageWrap: {
    width: '100%',
    height: 220,
    position: 'relative',
  },

  productImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EAEAE7',
  },

  productContent: {
    padding: 18,
  },

  bestMatchBadge: {
    position: 'absolute',
    top: 13,
    left: 13,
    backgroundColor: '#111111',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  bestMatchText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  productCategory: {
    fontSize: 11,
    color: '#888888',
    fontWeight: '700',
    marginBottom: 5,
  },

  productTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
    lineHeight: 26,
  },

  description: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 21,
    marginTop: 8,
  },

  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 13,
    gap: 7,
  },

  detail: {
    backgroundColor: '#F3F3F1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 12,
    color: '#555555',
    fontWeight: '600',
  },

  productFooter: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  price: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111111',
  },

  viewButton: {
    backgroundColor: '#111111',
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },

  viewButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  infoCard: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    padding: 17,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E3E3E0',
  },

  infoText: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 20,
  },

  errorCard: {
    marginTop: 20,
    padding: 17,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E3E3E0',
  },

  errorText: {
    color: '#B42318',
    fontSize: 14,
  },

  caption: {
    marginTop: 30,
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
  },
})


