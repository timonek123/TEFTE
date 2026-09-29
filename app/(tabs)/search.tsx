import React, { useEffect, useMemo, useState } from 'react'
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

const API_URL = 'http://192.168.68.55:3000'

type Product = {
  id: string
  title: string
  category: string
  price: number
  currency: string
  description: string
  condition: string
  weightKg?: number
  imageUrl?: string | null
  imageUrls?: string[]
}

const categories = [
  'All',
  'Electronics',
  'Home',
  'Fashion',
  'Sports',
  'Outdoor',
  'Vehicles',
  'Gaming',
  'Collectibles',
]

export default function SearchScreen() {
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadProducts() {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`${API_URL}/api/products`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Could not load products')
      }

      setProducts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Catalog error:', error)
      setError('Could not load the TEFTE marketplace.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const filteredProducts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase()

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        product.category.toLowerCase() === selectedCategory.toLowerCase()

      const matchesQuery =
        !cleanQuery ||
        product.title.toLowerCase().includes(cleanQuery) ||
        product.description.toLowerCase().includes(cleanQuery) ||
        product.category.toLowerCase().includes(cleanQuery) ||
        product.condition.toLowerCase().includes(cleanQuery)

      return matchesCategory && matchesQuery
    })
  }, [products, query, selectedCategory])

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

  function openProduct(product: Product) {
    router.push({
      pathname: '/product/[id]',
      params: {
        id: product.id,
      },
    })
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Search</Text>

        <Text style={styles.subtitle}>
          Browse everything on TEFTE.
        </Text>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>вЊ•</Text>

          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search products..."
            placeholderTextColor="#999999"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {query.length > 0 ? (
            <Pressable
              style={styles.clearButton}
              onPress={() => setQuery('')}
            >
              <Text style={styles.clearButtonText}>Г—</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {categories.map((category) => {
            const active = selectedCategory === category

            return (
              <Pressable
                key={category}
                style={[
                  styles.categoryChip,
                  active && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    active && styles.categoryTextActive,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>
            {selectedCategory === 'All'
              ? 'Marketplace'
              : selectedCategory}
          </Text>

          {!loading ? (
            <Text style={styles.resultCount}>
              {filteredProducts.length}{' '}
              {filteredProducts.length === 1 ? 'item' : 'items'}
            </Text>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>
              Loading marketplace...
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.messageCard}>
            <Text style={styles.errorText}>{error}</Text>

            <Pressable
              style={styles.retryButton}
              onPress={loadProducts}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && filteredProducts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>вЊ•</Text>

            <Text style={styles.emptyTitle}>
              Nothing found
            </Text>

            <Text style={styles.emptyText}>
              Try another search or choose a different category.
            </Text>

            <Pressable
              style={styles.resetButton}
              onPress={() => {
                setQuery('')
                setSelectedCategory('All')
              }}
            >
              <Text style={styles.resetButtonText}>
                Show all products
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error ? (
          <View style={styles.grid}>
            {filteredProducts.map((product) => {
              const imageUri = getProductImage(product)

              return (
                <Pressable
                  key={product.id}
                  style={styles.productCard}
                  onPress={() => openProduct(product)}
                >
                  {imageUri ? (
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.productImage,
                        styles.imagePlaceholder,
                      ]}
                    >
                      <Text style={styles.placeholderBrand}>
                        TEFTE
                      </Text>
                      <Text style={styles.placeholderText}>
                        No photo yet
                      </Text>
                    </View>
                  )}

                  <View style={styles.productContent}>
                    <Text style={styles.productCategory}>
                      {product.category}
                    </Text>

                    <Text
                      style={styles.productTitle}
                      numberOfLines={2}
                    >
                      {product.title}
                    </Text>

                    <Text
                      style={styles.productDescription}
                      numberOfLines={2}
                    >
                      {product.description}
                    </Text>

                    <View style={styles.metaRow}>
                      <Text style={styles.condition}>
                        {product.condition}
                      </Text>

                      {product.weightKg ? (
                        <Text style={styles.condition}>
                          {product.weightKg} kg
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.productBottom}>
                      <Text style={styles.price}>
                        {product.price} {product.currency}
                      </Text>

                      <Text style={styles.arrow}>в†’</Text>
                    </View>
                  </View>
                </Pressable>
              )
            })}
          </View>
        ) : null}

        <Text style={styles.caption}>
          {products.length} products on TEFTE
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

  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 110,
  },

  title: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '800',
    color: '#111111',
  },

  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: '#777777',
  },

  searchBox: {
    minHeight: 54,
    marginTop: 22,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 18,
  },

  searchIcon: {
    marginRight: 9,
    fontSize: 24,
    color: '#777777',
  },

  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111111',
  },

  clearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#F1F1EF',
  },

  clearButtonText: {
    marginTop: -2,
    fontSize: 23,
    color: '#555555',
  },

  categories: {
    gap: 9,
    paddingTop: 15,
    paddingRight: 20,
  },

  categoryChip: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 18,
  },

  categoryChipActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },

  categoryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#444444',
  },

  categoryTextActive: {
    color: '#FFFFFF',
  },

  resultsHeader: {
    marginTop: 28,
    marginBottom: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  resultsTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111111',
  },

  resultCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888888',
  },

  grid: {
    gap: 14,
  },

  productCard: {
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 22,
  },

  productImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#EAEAE7',
  },

  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderBrand: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#A4A4A0',
  },

  placeholderText: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: '600',
    color: '#AAAAA6',
  },

  productContent: {
    padding: 17,
  },

  productCategory: {
    marginBottom: 5,
    fontSize: 11,
    fontWeight: '700',
    color: '#888888',
  },

  productTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
    color: '#111111',
  },

  productDescription: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: '#707070',
  },

  metaRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },

  condition: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: 'hidden',
    borderRadius: 11,
    backgroundColor: '#F3F3F1',
    fontSize: 11,
    fontWeight: '600',
    color: '#555555',
  },

  productBottom: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  price: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111111',
  },

  arrow: {
    fontSize: 22,
    color: '#111111',
  },

  messageCard: {
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 18,
  },

  messageTitle: {
    fontSize: 14,
    color: '#666666',
  },

  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#B42318',
  },

  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#111111',
    borderRadius: 13,
  },

  retryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  emptyCard: {
    paddingVertical: 34,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 22,
  },

  emptyIcon: {
    fontSize: 34,
    color: '#999999',
  },

  emptyTitle: {
    marginTop: 8,
    fontSize: 19,
    fontWeight: '800',
    color: '#111111',
  },

  emptyText: {
    maxWidth: 260,
    marginTop: 7,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: '#777777',
  },

  resetButton: {
    marginTop: 16,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#111111',
    borderRadius: 13,
  },

  resetButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  caption: {
    marginTop: 28,
    textAlign: 'center',
    fontSize: 12,
    color: '#999999',
  },
})
