import React, { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

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

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true)
        setError('')

        const response = await fetch(`${API_URL}/api/products`)
        const products: Product[] = await response.json()

        if (!response.ok) {
          throw new Error('Could not load products')
        }

        const foundProduct = products.find(
          (item) => item.id === id
        )

        if (!foundProduct) {
          throw new Error('Product not found')
        }

        setProduct(foundProduct)
      } catch (error) {
        console.error(error)
        setError('Could not load this product.')
      } finally {
        setLoading(false)
      }
    }

    loadProduct()
  }, [id])

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>
            Loading product...
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error || !product) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {error || 'Product not found.'}
          </Text>

          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>
              Go back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={styles.backLink}
          onPress={() => router.back()}
        >
          <Text style={styles.backLinkText}>
            ← Back
          </Text>
        </Pressable>

        <Text style={styles.category}>
          {product.category}
        </Text>

        <Text style={styles.title}>
          {product.title}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {product.price} {product.currency}
          </Text>
        </View>

        <View style={styles.detailsRow}>
          {product.weightKg ? (
            <View style={styles.detailPill}>
              <Text style={styles.detailText}>
                {product.weightKg} kg
              </Text>
            </View>
          ) : null}

          <View style={styles.detailPill}>
            <Text style={styles.detailText}>
              {product.condition}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            About this product
          </Text>

          <Text style={styles.description}>
            {product.description}
          </Text>
        </View>

        <View style={styles.paymentCard}>
          <Text style={styles.paymentLabel}>
            PRICE
          </Text>

          <Text style={styles.paymentPrice}>
            {product.price} {product.currency}
          </Text>

          <Text style={styles.paymentHint}>
            Secure payment with your Solana wallet.
          </Text>

          <Pressable style={styles.buyButton}>
            <Text style={styles.buyButtonText}>
              Buy with Solana
            </Text>
          </Pressable>
        </View>

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

  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 50,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  loadingText: {
    marginTop: 14,
    fontSize: 15,
    color: '#666666',
  },

  errorText: {
    fontSize: 16,
    color: '#B42318',
    textAlign: 'center',
  },

  backButton: {
    marginTop: 20,
    backgroundColor: '#111111',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },

  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  backLink: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 28,
  },

  backLinkText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },

  category: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '700',
    marginBottom: 8,
  },

  title: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '800',
    color: '#111111',
  },

  priceRow: {
    marginTop: 20,
  },

  price: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111111',
  },

  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },

  detailPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  detailText: {
    fontSize: 13,
    color: '#555555',
    fontWeight: '600',
  },

  section: {
    marginTop: 38,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 12,
  },

  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555555',
  },

  paymentCard: {
    marginTop: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 22,
    padding: 20,
  },

  paymentLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#888888',
    letterSpacing: 0.7,
  },

  paymentPrice: {
    marginTop: 7,
    fontSize: 28,
    fontWeight: '800',
    color: '#111111',
  },

  paymentHint: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#777777',
  },

  buyButton: {
    marginTop: 20,
    backgroundColor: '#111111',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
  },

  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  caption: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 13,
    color: '#888888',
  },
})