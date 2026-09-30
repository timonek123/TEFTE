import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router'

type Product = {
  id: string
  title: string
  price: number
  currency: string
  seller?: string
  imageUrl?: string
  images?: string[]
  imageUrls?: string[]
}

type Order = {
  id: string
  productId: string
  productTitle: string
  productPrice: number
  productCurrency: string
  buyer: string
  seller: string
  paymentMethod: string
  transactionSignature?: string | null
  status:
    | 'waiting_seller'
    | 'confirmed'
    | 'declined_by_seller'
    | 'cancelled_by_buyer'
    | 'shipped'
    | 'received'
    | 'completed'
  createdAt: string
  updatedAt: string
}
const API_URL = 'http://192.168.68.55:3000'

export default function OrderScreen() {
  const router = useRouter()

  const params =
    useLocalSearchParams<{
      id: string
      orderId?: string
      signature?: string
      role?: string
    }>()

  const id = Array.isArray(params.id)
    ? params.id[0]
    : params.id

  const orderId = Array.isArray(params.orderId)
    ? params.orderId[0]
    : params.orderId
  const signature = Array.isArray(params.signature)
    ? params.signature[0]
    : params.signature

  const role = Array.isArray(params.role)
    ? params.role[0]
    : params.role

  const isSeller = role === 'seller'
  const [order, setOrder] =
    useState<Order | null>(null)
  const [product, setProduct] =
    useState<Product | null>(null)

  const [loading, setLoading] =
    useState(true)
  const [cancelling, setCancelling] =
    useState(false)
  const [sellerDeciding, setSellerDeciding] =
    useState(false)

  useEffect(() => {
    loadOrderData()
  }, [id, orderId])

  async function loadOrderData() {
    try {
      setLoading(true)

      const productsResponse = await fetch(
        `${API_URL}/api/products`
      )

      if (!productsResponse.ok) {
        throw new Error(
          'Could not load products'
        )
      }

      const products: Product[] =
        await productsResponse.json()

      const found = products.find(
        (item) => item.id === id
      )

      setProduct(found ?? null)

      if (orderId) {
        const orderResponse = await fetch(
          `${API_URL}/api/orders/${orderId}`
        )

        if (!orderResponse.ok) {
          throw new Error(
            'Could not load order'
          )
        }

        const orderResult =
          await orderResponse.json()

        setOrder(orderResult.order)
      } else {
        setOrder(null)
      }
    } catch (error) {
      console.error(
        'TEFTE order loading error:',
        error
      )
    } finally {
      setLoading(false)
    }
  }
  async function cancelOrder() {
    if (!orderId || order?.status !== 'waiting_seller') {
      return
    }

    try {
      setCancelling(true)

      const response = await fetch(
        `${API_URL}/api/orders/${orderId}/buyer-cancel`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result?.error || 'Could not cancel order'
        )
      }

      setOrder(result.order)
    } catch (error) {
      console.error(
        'TEFTE cancel order error:',
        error
      )
    } finally {
      setCancelling(false)
    }
  }
  async function sellerDecision(
    decision: 'confirm' | 'decline'
  ) {
    if (
      !orderId ||
      order?.status !== 'waiting_seller' ||
      !isSeller
    ) {
      return
    }

    try {
      setSellerDeciding(true)

      const response = await fetch(
        `${API_URL}/api/orders/${orderId}/seller-decision`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            decision,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result?.error ||
            'Could not update order'
        )
      }

      setOrder(result.order)
    } catch (error) {
      console.error(
        'TEFTE seller decision error:',
        error
      )
    } finally {
      setSellerDeciding(false)
    }
  }
  function getImageUrl(
    image?: string
  ) {
    if (!image) {
      return undefined
    }

    if (
      image.startsWith('http://') ||
      image.startsWith('https://')
    ) {
      return image
    }

    return `${API_URL}${image}`
  }

  function getMainImage() {
    if (!product) {
      return undefined
    }

    const image =
      product.images?.[0] ??
      product.imageUrls?.[0] ??
      product.imageUrl

    return getImageUrl(image)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />

          <Text style={styles.loadingText}>
            Preparing your order...
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>
            Order not found
          </Text>

          <Pressable
            style={styles.homeButton}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.homeButtonText}>
              Back to TEFTE
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const mainImage = getMainImage()

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.successIcon}>
          <Text style={styles.successIconText}>
            OK
          </Text>
        </View>

        <Text style={styles.title}>
          {order?.status === 'cancelled_by_buyer'
            ? 'Order cancelled'
            : order?.status === 'declined_by_seller'
              ? 'Order declined'
              : order?.status === 'confirmed'
                ? 'Order confirmed'
                : order?.status === 'shipped'
                  ? 'Order shipped'
                  : order?.status === 'received'
                    ? 'Item received'
                    : order?.status === 'completed'
                      ? 'Order completed'
                      : 'Payment confirmed'}
        </Text>

        <Text style={styles.subtitle}>
          {order?.status === 'cancelled_by_buyer'
            ? 'You cancelled this order before the seller confirmed it.'
            : order?.status === 'declined_by_seller'
              ? 'The seller declined this order.'
              : order?.status === 'confirmed'
                ? 'The seller confirmed your order.'
                : order?.status === 'shipped'
                  ? 'The seller marked your order as shipped.'
                  : order?.status === 'received'
                    ? 'Delivery has been confirmed.'
                    : order?.status === 'completed'
                      ? 'This TEFTE deal is complete.'
                      : 'Waiting for the seller to confirm your order.'}
        </Text>
        <View style={styles.productCard}>
          {mainImage ? (
            <Image
              source={{ uri: mainImage }}
              style={styles.productImage}
            />
          ) : (
            <View
              style={[
                styles.productImage,
                styles.imagePlaceholder,
              ]}
            >
              <Text style={styles.placeholderText}>
                TEFTE
              </Text>
            </View>
          )}

          <View style={styles.productInfo}>
            <Text
              style={styles.productTitle}
              numberOfLines={2}
            >
              {product.title}
            </Text>

            <Text style={styles.sellerText}>
              Seller: {product.seller ?? 'TEFTE seller'}
            </Text>

            <Text style={styles.price}>
              {product.price} {product.currency}
            </Text>
          </View>
        </View>

        <View style={styles.protectionCard}>
          <View style={styles.protectionHeader}>
            <View style={styles.shield}>
              <Text style={styles.shieldText}>
                вњ“
              </Text>
            </View>

            <View style={styles.protectionHeaderText}>
              <Text style={styles.protectionTitle}>
                TEFTE Protection
              </Text>

              <Text style={styles.protectionSubtitle}>
                Protected transaction
              </Text>
            </View>
          </View>

          <Text style={styles.protectionText}>
            TEFTE tracks the deal from payment
            through delivery and completion.
          </Text>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.sectionTitle}>
            Order status
          </Text>

          <View style={styles.step}>
            <View
              style={[
                styles.stepCircle,
                styles.stepCircleActive,
              ]}
            >
              <Text style={styles.stepCheck}>
                OK
              </Text>
            </View>

            <View style={styles.stepContent}>
              <Text style={styles.stepTitleActive}>
                Paid
              </Text>

              <Text style={styles.stepDescription}>
                Payment confirmed
              </Text>
            </View>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.step}>
            <View
              style={[
                styles.stepCircle,
                order?.status === 'waiting_seller' &&
                  styles.stepCircleActive,
              ]}
            >
              <Text
                style={
                  order?.status === 'waiting_seller'
                    ? styles.stepTitleActive
                    : styles.stepNumber
                }
              >
                2
              </Text>
            </View>

            <View style={styles.stepContent}>
              <Text
                style={
                  order?.status === 'waiting_seller'
                    ? styles.stepTitleActive
                    : styles.stepTitle
                }
              >
                {order?.status === 'waiting_seller'
                  ? 'Waiting for seller'
                  : order?.status === 'confirmed'
                    ? 'Seller confirmed'
                    : order?.status ===
                        'declined_by_seller'
                      ? 'Seller declined'
                      : order?.status ===
                          'cancelled_by_buyer'
                        ? 'Order cancelled'
                        : 'Seller confirmation'}
              </Text>

              <Text style={styles.stepDescription}>
                {order?.status === 'waiting_seller'
                  ? 'Seller needs to confirm the order'
                  : order?.status === 'confirmed'
                    ? 'Seller accepted the order'
                    : order?.status ===
                        'declined_by_seller'
                      ? 'Seller declined the order'
                      : order?.status ===
                          'cancelled_by_buyer'
                        ? 'Cancelled before seller confirmation'
                        : 'Waiting for order update'}
              </Text>
            </View>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.step}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNumber}>
                3
              </Text>
            </View>

            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>
                Shipped
              </Text>

              <Text style={styles.stepDescription}>
                Seller ships the item
              </Text>
            </View>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.step}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNumber}>
                4
              </Text>
            </View>

            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>
                Received
              </Text>

              <Text style={styles.stepDescription}>
                Buyer confirms delivery
              </Text>
            </View>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.step}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNumber}>
                5
              </Text>
            </View>

            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>
                Seller paid
              </Text>

              <Text style={styles.stepDescription}>
                Deal completed
              </Text>
            </View>
          </View>
        </View>
        {signature ? (
          <View style={styles.transactionCard}>
            <Text style={styles.transactionLabel}>
              Solana transaction
            </Text>

            <Text
              style={styles.transactionValue}
              numberOfLines={1}
            >
              {signature}
            </Text>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            What happens next?
          </Text>

          <Text style={styles.infoText}>
            The seller prepares and ships your
            order. TEFTE will keep the transaction
            status simple and visible here.
          </Text>
        </View>

        {order?.status === 'waiting_seller' ? (
          <Pressable
            style={styles.cancelButton}
            onPress={cancelOrder}
            disabled={cancelling}
          >
            <Text style={styles.cancelButtonText}>
              {cancelling
                ? 'Cancelling...'
                : 'Cancel order'}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.homeButton}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.homeButtonText}>
            Continue shopping
          </Text>
        </Pressable>

        <Text style={styles.footer}>
          Paid в†’ Shipped в†’ Received в†’ Seller paid
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#777777',
  },

  errorTitle: {
    marginBottom: 18,
    fontSize: 22,
    fontWeight: '800',
    color: '#111111',
  },

  successIcon: {
    width: 72,
    height: 72,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    backgroundColor: '#DCFCE7',
  },

  successIconText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#15803D',
  },

  title: {
    marginTop: 18,
    textAlign: 'center',
    fontSize: 27,
    fontWeight: '900',
    color: '#111111',
  },

  subtitle: {
    marginTop: 8,
    paddingHorizontal: 20,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: '#666666',
  },

  productCard: {
    flexDirection: 'row',
    marginTop: 28,
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  productImage: {
    width: 92,
    height: 92,
    borderRadius: 15,
    backgroundColor: '#EEEEEE',
  },

  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#999999',
  },

  productInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 14,
  },

  productTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    color: '#111111',
  },

  sellerText: {
    marginTop: 5,
    fontSize: 12,
    color: '#777777',
  },

  price: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
  },

  protectionCard: {
    marginTop: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#ECFDF3',
  },

  protectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  shield: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#D1FAE5',
  },

  shieldText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#15803D',
  },

  protectionHeaderText: {
    flex: 1,
    marginLeft: 12,
  },

  protectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#14532D',
  },

  protectionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#4D7C5A',
  },

  protectionText: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 19,
    color: '#3F684A',
  },

  statusCard: {
    marginTop: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  sectionTitle: {
    marginBottom: 20,
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
  },

  step: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  stepCircle: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#EEEEEE',
  },

  stepCircleActive: {
    backgroundColor: '#DCFCE7',
  },

  stepCheck: {
    fontSize: 17,
    fontWeight: '900',
    color: '#15803D',
  },

  stepNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#999999',
  },

  stepContent: {
    flex: 1,
    marginLeft: 13,
  },

  stepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#999999',
  },

  stepTitleActive: {
    fontSize: 14,
    fontWeight: '900',
    color: '#15803D',
  },

  stepDescription: {
    marginTop: 2,
    fontSize: 12,
    color: '#999999',
  },

  stepLine: {
    width: 2,
    height: 24,
    marginLeft: 16,
    backgroundColor: '#E5E5E5',
  },

  transactionCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },

  transactionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#888888',
  },

  transactionValue: {
    marginTop: 7,
    fontSize: 12,
    color: '#333333',
  },

  infoCard: {
    marginTop: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  infoTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
  },

  infoText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#666666',
  },

  cancelButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D92D20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    paddingHorizontal: 18,
  },

  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D92D20',
  },
  homeButton: {
    minHeight: 56,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#111111',
  },

  homeButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  footer: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 11,
    color: '#999999',
  },
})










