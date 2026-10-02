import { API_URL } from '../../lib/api'
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
export default function OrderScreen() {
  const router = useRouter()

  const params =
    useLocalSearchParams<{
      id: string
      orderId?: string
      signature?: string
      reward?: string
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
  const reward = Array.isArray(params.reward)
    ? params.reward[0]
    : params.reward

  const [order, setOrder] =
    useState<Order | null>(null)
  const sellerConfirmed =
    order?.status === 'confirmed' ||
    order?.status === 'shipped' ||
    order?.status === 'received' ||
    order?.status === 'completed'

  const orderShipped =
    order?.status === 'shipped' ||
    order?.status === 'received' ||
    order?.status === 'completed'

  const orderReceived =
    order?.status === 'received' ||
    order?.status === 'completed'

  const orderCompleted =
    order?.status === 'completed'
  const isSkrDemoReward =
    reward === 'skr-demo' ||
    order?.paymentMethod === 'SKR'
  const [product, setProduct] =
    useState<Product | null>(null)

  const [loading, setLoading] =
    useState(true)
  const [cancelling, setCancelling] =
    useState(false)
  const [sellerDeciding, setSellerDeciding] =
    useState(false)
  const [shipping, setShipping] =
    useState(false)
  const [receiving, setReceiving] =
    useState(false)
  const [completing, setCompleting] =
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
  async function markAsShipped() {
    if (
      !orderId ||
      order?.status !== 'confirmed' ||
      !isSeller
    ) {
      return
    }

    try {
      setShipping(true)

      const response = await fetch(
        `${API_URL}/api/orders/${orderId}/seller-ship`,
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
          result?.error ||
            'Could not mark order as shipped'
        )
      }

      setOrder(result.order)
    } catch (error) {
      console.error(
        'TEFTE shipping error:',
        error
      )
    } finally {
      setShipping(false)
    }
  }
  async function confirmReceived() {
    if (
      !orderId ||
      order?.status !== 'shipped' ||
      isSeller
    ) {
      return
    }

    try {
      setReceiving(true)

      const response = await fetch(
        `${API_URL}/api/orders/${orderId}/buyer-received`,
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
          result?.error ||
            'Could not confirm delivery'
        )
      }

      setOrder(result.order)
    } catch (error) {
      console.error(
        'TEFTE confirm received error:',
        error
      )
    } finally {
      setReceiving(false)
    }
  }
  async function completeOrder() {
    if (
      !orderId ||
      order?.status !== 'received'
    ) {
      return
    }

    try {
      setCompleting(true)

      const response = await fetch(
        `${API_URL}/api/orders/${orderId}/complete`,
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
          result?.error ||
            'Could not complete order'
        )
      }

      setOrder(result.order)
    } catch (error) {
      console.error(
        'TEFTE complete order error:',
        error
      )
    } finally {
      setCompleting(false)
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

        {isSkrDemoReward ? (
          <View style={styles.skrRewardCard}>
            <Text style={styles.skrRewardLabel}>
              SKR PURCHASE COMPLETE
            </Text>

            <Text style={styles.skrRewardXp}>
              +100 TEFTE XP
            </Text>

            <Text style={styles.skrRewardText}>
              1 Listing Boost earned
            </Text>
          </View>
        ) : null}
        <View style={styles.protectionCard}>
          <View style={styles.protectionHeader}>
            <View style={styles.shield}>
              <Text style={styles.shieldText}>
                OK
              </Text>
            </View>

            <View style={styles.protectionHeaderText}>
              <Text style={styles.protectionTitle}>
                TEFTE Protection
              </Text>

              <Text style={styles.protectionSubtitle}>
                Order protection workflow
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
                (sellerConfirmed ||
                  order?.status === 'waiting_seller') &&
                  styles.stepCircleActive,
              ]}
            >
              <Text
                style={
                  sellerConfirmed ||
                  order?.status === 'waiting_seller'
                    ? styles.stepCheck
                    : styles.stepNumber
                }
              >
                {sellerConfirmed ? 'OK' : '2'}
              </Text>
            </View>

            <View style={styles.stepContent}>
              <Text
                style={
                  sellerConfirmed ||
                  order?.status === 'waiting_seller'
                    ? styles.stepTitleActive
                    : styles.stepTitle
                }
              >
                {sellerConfirmed
                  ? 'Seller confirmed'
                  : order?.status === 'waiting_seller'
                    ? 'Waiting for seller'
                    : order?.status === 'declined_by_seller'
                      ? 'Seller declined'
                      : order?.status === 'cancelled_by_buyer'
                        ? 'Order cancelled'
                        : 'Seller confirmation'}
              </Text>

              <Text style={styles.stepDescription}>
                {sellerConfirmed
                  ? 'Seller accepted the order'
                  : order?.status === 'waiting_seller'
                    ? 'Seller needs to confirm the order'
                    : order?.status === 'declined_by_seller'
                      ? 'Seller declined the order'
                      : order?.status === 'cancelled_by_buyer'
                        ? 'Cancelled before seller confirmation'
                        : 'Waiting for seller confirmation'}
              </Text>
            </View>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.step}>
            <View
              style={[
                styles.stepCircle,
                orderShipped &&
                  styles.stepCircleActive,
              ]}
            >
              <Text
                style={
                  orderShipped
                    ? styles.stepCheck
                    : styles.stepNumber
                }
              >
                {orderShipped ? 'OK' : '3'}
              </Text>
            </View>

            <View style={styles.stepContent}>
              <Text
                style={
                  orderShipped
                    ? styles.stepTitleActive
                    : styles.stepTitle
                }
              >
                Shipped
              </Text>

              <Text style={styles.stepDescription}>
                Seller ships the item
              </Text>
            </View>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.step}>
            <View
              style={[
                styles.stepCircle,
                orderReceived &&
                  styles.stepCircleActive,
              ]}
            >
              <Text
                style={
                  orderReceived
                    ? styles.stepCheck
                    : styles.stepNumber
                }
              >
                {orderReceived ? 'OK' : '4'}
              </Text>
            </View>

            <View style={styles.stepContent}>
              <Text
                style={
                  orderReceived
                    ? styles.stepTitleActive
                    : styles.stepTitle
                }
              >
                Received
              </Text>

              <Text style={styles.stepDescription}>
                Buyer confirms delivery
              </Text>
            </View>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.step}>
            <View
              style={[
                styles.stepCircle,
                orderCompleted &&
                  styles.stepCircleActive,
              ]}
            >
              <Text
                style={
                  orderCompleted
                    ? styles.stepCheck
                    : styles.stepNumber
                }
              >
                {orderCompleted ? 'OK' : '5'}
              </Text>
            </View>

            <View style={styles.stepContent}>
              <Text
                style={
                  orderCompleted
                    ? styles.stepTitleActive
                    : styles.stepTitle
                }
              >
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
              {isSkrDemoReward ? 'SKR demo reference' : 'Solana transaction'}
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
            {order?.status === 'waiting_seller'
              ? isSeller
                ? 'Review the order and choose Confirm order or Decline.'
                : 'Waiting for the seller to confirm your order.'
              : order?.status === 'confirmed'
                ? isSeller
                  ? 'Prepare the item and mark the order as shipped when it is on the way.'
                  : 'The seller confirmed your order and is preparing it for shipment.'
                : order?.status === 'shipped'
                  ? isSeller
                    ? 'The order is marked as shipped. Waiting for the buyer to confirm delivery.'
                    : 'Your order is on the way. Confirm received after it arrives.'
                  : order?.status === 'received'
                    ? 'Delivery has been confirmed. Complete the order to finish the TEFTE workflow.'
                    : order?.status === 'completed'
                      ? 'This TEFTE deal is complete.'
                      : order?.status === 'cancelled_by_buyer'
                        ? 'This order was cancelled before seller confirmation.'
                        : order?.status === 'declined_by_seller'
                          ? 'The seller declined this order.'
                          : 'TEFTE will keep the order status visible here.'}
          </Text>
        </View>
        {order?.status === 'waiting_seller' &&
        isSeller ? (
          <View style={styles.sellerActions}>
            <Pressable
              style={styles.confirmButton}
              onPress={() =>
                sellerDecision('confirm')
              }
              disabled={sellerDeciding}
            >
              <Text style={styles.confirmButtonText}>
                {sellerDeciding
                  ? 'Processing...'
                  : 'Confirm order'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.declineButton}
              onPress={() =>
                sellerDecision('decline')
              }
              disabled={sellerDeciding}
            >
              <Text style={styles.declineButtonText}>
                Decline
              </Text>
            </Pressable>
          </View>
        ) : null}

        {order?.status === 'received' ? (
          <Pressable
            style={styles.confirmButton}
            onPress={completeOrder}
            disabled={completing}
          >
            <Text style={styles.confirmButtonText}>
              {completing
                ? 'Completing...'
                : 'Complete order'}
            </Text>
          </Pressable>
        ) : null}
        {order?.status === 'shipped' &&
        !isSeller ? (
          <Pressable
            style={styles.confirmButton}
            onPress={confirmReceived}
            disabled={receiving}
          >
            <Text style={styles.confirmButtonText}>
              {receiving
                ? 'Updating...'
                : 'Confirm received'}
            </Text>
          </Pressable>
        ) : null}
        {order?.status === 'confirmed' &&
        isSeller ? (
          <Pressable
            style={styles.confirmButton}
            onPress={markAsShipped}
            disabled={shipping}
          >
            <Text style={styles.confirmButtonText}>
              {shipping
                ? 'Updating...'
                : 'Mark as shipped'}
            </Text>
          </Pressable>
        ) : null}
        {order?.status === 'waiting_seller' &&
        !isSeller ? (
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
          {'Paid > Seller confirmed > Shipped > Received > Seller paid'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  skrRewardCard: {
    backgroundColor: '#F1EDFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },

  skrRewardLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6547A8',
    marginBottom: 6,
  },

  skrRewardXp: {
    fontSize: 24,
    fontWeight: '900',
    color: '#2F2450',
    marginBottom: 4,
  },

  skrRewardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5E5670',
  },
  sellerActions: {
    gap: 10,
    marginTop: 4,
  },

  confirmButton: {
    backgroundColor: '#111111',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  declineButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },

  declineButtonText: {
    color: '#B42318',
    fontSize: 15,
    fontWeight: '700',
  },
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




































