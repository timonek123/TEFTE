import { API_URL } from '../../lib/api'
import React, { useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import {
  address,
  appendTransactionMessageInstruction,
  compileTransaction,
  createTransactionMessage,
  lamports,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
} from '@solana/kit'
import { getTransferSolInstruction } from '@solana-program/system'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ActivityIndicator,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

const SELLER_ADDRESS = address(
  'GqozyB3iStZU8kW5T1wdPWq8YnGX4XKd7TC9Zs5xTmMw'
)

const SCREEN_WIDTH = Dimensions.get('window').width
const PAGE_HORIZONTAL_PADDING = 24
const GALLERY_WIDTH =
  SCREEN_WIDTH - PAGE_HORIZONTAL_PADDING * 2

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

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const {
    account,
    client,
    getTransactionSigner,
    signAndSendTransactions,
  } = useMobileWallet()

  const [product, setProduct] =
    useState<Product | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeImageIndex, setActiveImageIndex] =
    useState(0)

  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true)
        setError('')

        const response = await fetch(
          `${API_URL}/api/products`
        )

        const products: Product[] =
          await response.json()

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

        setError(
          'Could not load this product.'
        )
      } finally {
        setLoading(false)
      }
    }

    loadProduct()
  }, [id])

  const productImages = useMemo(() => {
    if (!product) {
      return []
    }

    if (
      Array.isArray(product.imageUrls) &&
      product.imageUrls.length > 0
    ) {
      return product.imageUrls
    }

    if (product.imageUrl) {
      return [product.imageUrl]
    }

    return []
  }, [product])

  function handleGalleryScrollEnd(
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) {
    const offsetX =
      event.nativeEvent.contentOffset.x

    const nextIndex = Math.round(
      offsetX / GALLERY_WIDTH
    )

    setActiveImageIndex(nextIndex)
  }

  function handleMessageSeller() {
    if (!product) {
      return
    }

    const chatId =
      product.id === 'user-1790605722969'
        ? 'demo-samsung'
        : product.id === 'user-1790667942743'
          ? 'demo-snow-globe'
          : 'demo-samsung'

    router.push({
      pathname: '/chat/[id]',
      params: { id: chatId },
    })
  }
  async function handleBuy() {
    if (!account) {
      console.error(
        'TEFTE payment error: wallet is not connected'
      )
      return
    }

    try {
      const {
        context: { slot: minContextSlot },
        value: latestBlockhash,
      } =
        await client.rpc
          .getLatestBlockhash()
          .send()

      const buyerSigner =
        getTransactionSigner(
          account.address,
          minContextSlot
        )

      const transferInstruction =
        getTransferSolInstruction({
          source: buyerSigner,
          destination: SELLER_ADDRESS,
          amount: lamports(1000000n),
        })

      const transactionMessage = pipe(
        createTransactionMessage({
          version: 0,
        }),

        (tx) =>
          appendTransactionMessageInstruction(
            transferInstruction,
            tx
          ),

        (tx) =>
          setTransactionMessageFeePayerSigner(
            buyerSigner,
            tx
          ),

        (tx) =>
          setTransactionMessageLifetimeUsingBlockhash(
            latestBlockhash,
            tx
          )
      )

      const transaction =
        compileTransaction(
          transactionMessage
        )

      const signature =
        await signAndSendTransactions(
          transaction,
          minContextSlot
        )

      console.log(
        'TEFTE payment signature:',
        signature
      )
    } catch (error) {
      console.error(
        'TEFTE payment error:',
        error
      )
    }
  }

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
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <Pressable
          style={styles.backLink}
          onPress={() => router.back()}
        >
          <Text style={styles.backLinkText}>
            Back
          </Text>
        </Pressable>

        {productImages.length > 0 ? (
          <View style={styles.gallery}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={
                false
              }
              onMomentumScrollEnd={
                handleGalleryScrollEnd
              }
            >
              {productImages.map(
                (imagePath, index) => (
                  <Image
                    key={`${imagePath}-${index}`}
                    source={{
                      uri: `${API_URL}${imagePath}`,
                    }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                )
              )}
            </ScrollView>

            {productImages.length > 1 ? (
              <>
                <View
                  style={styles.imageCounter}
                >
                  <Text
                    style={
                      styles.imageCounterText
                    }
                  >
                    {activeImageIndex + 1} /{' '}
                    {productImages.length}
                  </Text>
                </View>

                <View style={styles.dots}>
                  {productImages.map(
                    (_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.dot,
                          index ===
                            activeImageIndex &&
                            styles.activeDot,
                        ]}
                      />
                    )
                  )}
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.category}>
          {product.category}
        </Text>

        <Text style={styles.title}>
          {product.title}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {product.price}{' '}
            {product.currency}
          </Text>
        </View>

        <View style={styles.detailsRow}>
          {product.weightKg ? (
            <View style={styles.detailPill}>
              <Text
                style={styles.detailText}
              >
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
          <Text
            style={styles.paymentLabel}
          >
            PRICE
          </Text>

          <Text
            style={styles.paymentPrice}
          >
            {product.price}{' '}
            {product.currency}
          </Text>

          <Text
            style={styles.paymentHint}
          >
            Devnet test payment through
            your Solana wallet.
          </Text>

          <Pressable
            style={styles.messageSellerButton}
            onPress={handleMessageSeller}
          >
            <Text style={styles.messageSellerButtonText}>
              Message seller
            </Text>
          </Pressable>

          <Pressable
            style={styles.buyButton}
            onPress={() =>
              router.push({
                pathname: '/checkout/[id]',
                params: { id: product.id },
              })
            }
          >
            <Text style={styles.buyButtonText}>
              Buy with Solana
            </Text>
          </Pressable>
        </View>
        <Text style={styles.caption}>
          AI-powered marketplace on
          Solana
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
    paddingHorizontal:
      PAGE_HORIZONTAL_PADDING,
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
    marginBottom: 18,
  },

  backLinkText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },

  gallery: {
    width: GALLERY_WIDTH,
    marginBottom: 24,
    position: 'relative',
  },

  productImage: {
    width: GALLERY_WIDTH,
    height: 340,
    borderRadius: 24,
    backgroundColor: '#EAEAE7',
  },

  imageCounter: {
    position: 'absolute',
    right: 14,
    top: 14,
    backgroundColor:
      'rgba(0, 0, 0, 0.65)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  imageCounterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#C9C9C5',
  },

  activeDot: {
    width: 20,
    backgroundColor: '#111111',
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

  messageSellerButton: {
    marginTop: 20,
    borderWidth: 1.5,
    borderColor: '#111111',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  messageSellerButtonText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '800',
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







