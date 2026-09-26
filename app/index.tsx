import React, { useState } from 'react'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
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
}

export default function HomeScreen() {
  const { account, connect } = useMobileWallet()
const router = useRouter()

  const [query, setQuery] = useState('')
  const [summary, setSummary] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch() {
    const cleanQuery = query.trim()

    if (!cleanQuery || loading) {
      return
    }

    try {
      setLoading(true)
      setSummary('')
      setProducts([])
      setError('')

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

      setSummary(data.summary || '')
      setProducts(Array.isArray(data.products) ? data.products : [])
    } catch (error) {
      console.error(error)
      setError('Could not connect to Vendra server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>Vendra</Text>

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

        <View style={styles.hero}>
          <Text style={styles.title}>
            What are you looking for?
          </Text>

          <Text style={styles.subtitle}>
            Tell Vendra what you want. AI will find the best matches.
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
            onPress={handleSearch}
            disabled={!query.trim() || loading}
          >
            <Text style={styles.searchButtonText}>
              {loading ? 'Searching...' : 'Ask Vendra'}
            </Text>
          </Pressable>

          {summary ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>
                Vendra recommends
              </Text>

              <Text style={styles.summaryText}>
                {summary}
              </Text>
            </View>
          ) : null}

          {products.length > 0 ? (
            <View style={styles.results}>
              <Text style={styles.resultsTitle}>
                Recommended for you
              </Text>

              {products.map((product, index) => (
                <View key={product.id} style={styles.productCard}>
                  {index === 0 ? (
                    <View style={styles.bestMatchBadge}>
                      <Text style={styles.bestMatchText}>
                        BEST MATCH
                      </Text>
                    </View>
                  ) : null}

                  <Text style={styles.category}>
                    {product.category}
                  </Text>

                  <Text style={styles.productTitle}>
                    {product.title}
                  </Text>

                  <Text style={styles.description}>
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
                    <View>
                      <Text style={styles.price}>
                        {product.price} {product.currency}
                      </Text>
                    </View>

                   <Pressable
  style={styles.viewButton}
  onPress={() =>
    router.push({
      pathname: '/product/[id]',
      params: { id: product.id },
    })
  }
>
                      <Text style={styles.viewButtonText}>
                        View product
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {!loading && summary && products.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No matching products found.
              </Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : null}

          <Text style={styles.caption}>
            AI-powered marketplace on Solana
          </Text>
        </View>
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
    paddingHorizontal: 24,
  },

  scrollContent: {
    paddingTop: 24,
    paddingBottom: 50,
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
    paddingHorizontal: 14,
    paddingVertical: 10,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },

  walletButton: {
    backgroundColor: '#111111',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 20,
  },

  walletButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  hero: {
    marginTop: 70,
  },

  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#111111',
    lineHeight: 41,
  },

  subtitle: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 26,
  },

  searchInput: {
    minHeight: 86,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111111',
    textAlignVertical: 'top',
  },

  searchButton: {
    backgroundColor: '#111111',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },

  searchButtonDisabled: {
    opacity: 0.35,
  },

  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  summaryCard: {
    marginTop: 20,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 18,
  },

  summaryLabel: {
    fontSize: 12,
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
    marginTop: 28,
  },

  resultsTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 14,
  },

  productCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },

  bestMatchBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#111111',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 14,
  },

  bestMatchText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  category: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '600',
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
    marginTop: 9,
  },

  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    gap: 8,
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
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  price: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
  },

  viewButton: {
    backgroundColor: '#111111',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  viewButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  emptyCard: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E3E3E0',
  },

  emptyText: {
    color: '#666666',
    fontSize: 15,
  },

  errorCard: {
    marginTop: 20,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E3E3E0',
  },

  errorText: {
    color: '#B42318',
    fontSize: 15,
  },

  caption: {
    marginTop: 20,
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
  },
})