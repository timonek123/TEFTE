import { API_URL } from '../../lib/api'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router'

type CarrierCode =
  | 'nova_poshta'
  | 'ukrposhta'
  | 'meest'

const CARRIERS: Array<{
  code: CarrierCode
  label: string
}> = [
  {
    code: 'nova_poshta',
    label: 'Nova Poshta',
  },
  {
    code: 'ukrposhta',
    label: 'Ukrposhta',
  },
  {
    code: 'meest',
    label: 'Meest',
  },
]

function getCarrierLabel(
  carrier?: string | null,
) {
  return (
    CARRIERS.find(
      (item) => item.code === carrier,
    )?.label || carrier || 'Carrier'
  )
}

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
    | 'delivered'
    | 'disputed'
    | 'completed'
  carrier?: CarrierCode | null
  carrierStatus?: string | null
  trackingNumber?: string | null
  trackingVerifiedAt?: string | null
  shippedAt?: string | null
  deliveredAt?: string | null
  protectionEndsAt?: string | null
  disputedAt?: string | null
  disputeReason?: string | null
  completedAt?: string | null
  completionReason?: string | null
  createdAt: string
  updatedAt: string
}

type OrderReward = {
  orderId: string
  xpAwarded: number
  listingBoostsAwarded: number
  baseXp?: number
  spendBonusXp?: number
  awardedAt?: string
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

  const scrollRef = useRef<ScrollView>(null)

  const [order, setOrder] =
    useState<Order | null>(null)
  const [orderReward, setOrderReward] =
    useState<OrderReward | null>(null)
  const [now, setNow] =
    useState(Date.now())

  const sellerConfirmed =
    order?.status === 'confirmed' ||
    order?.status === 'shipped' ||
    order?.status === 'delivered' ||
    order?.status === 'disputed' ||
    order?.status === 'completed'

  const orderShipped =
    order?.status === 'shipped' ||
    order?.status === 'delivered' ||
    order?.status === 'disputed' ||
    order?.status === 'completed'

  const orderDelivered =
    order?.status === 'delivered' ||
    order?.status === 'disputed' ||
    order?.status === 'completed'

  const orderDisputed =
    order?.status === 'disputed'

  const orderCompleted =
    order?.status === 'completed'

  const isSkrOrder =
    reward === 'skr-demo' ||
    order?.paymentMethod === 'SKR'

  const protectionEndsAtMs =
    order?.protectionEndsAt
      ? new Date(order.protectionEndsAt).getTime()
      : 0

  const protectionRemainingMs =
    protectionEndsAtMs > now
      ? protectionEndsAtMs - now
      : 0

  const protectionHours =
    Math.floor(
      protectionRemainingMs /
        (60 * 60 * 1000)
    )

  const protectionMinutes =
    Math.max(
      0,
      Math.ceil(
        (protectionRemainingMs %
          (60 * 60 * 1000)) /
          (60 * 1000)
      )
    )

  const protectionTimeLabel =
    protectionRemainingMs > 0
      ? `${protectionHours}h ${protectionMinutes}m`
      : 'Protection window ended'

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
  const [selectedCarrier, setSelectedCarrier] =
    useState<CarrierCode>('nova_poshta')
  const [trackingInput, setTrackingInput] =
    useState('')
  const [confirmingDelivery, setConfirmingDelivery] =
    useState(false)
  const [disputing, setDisputing] =
    useState(false)

  useEffect(() => {
    loadOrderData()
  }, [id, orderId])

  useEffect(() => {
    const timer = setInterval(
      () => setNow(Date.now()),
      60 * 1000,
    )

    return () => clearInterval(timer)
  }, [])

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
        setOrderReward(
          orderResult.reward ?? null
        )

        if (
          CARRIERS.some(
            (item) =>
              item.code === orderResult.order?.carrier,
          )
        ) {
          setSelectedCarrier(
            orderResult.order.carrier,
          )
        }

        setTrackingInput(
          orderResult.order?.trackingNumber || '',
        )
      } else {
        setOrder(null)
        setOrderReward(null)
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

    const cleanTrackingNumber =
      trackingInput.trim()

    if (cleanTrackingNumber.length < 5) {
      Alert.alert(
        'Tracking number required',
        'Enter the tracking number from the delivery carrier.',
      )
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
          body: JSON.stringify({
            carrier: selectedCarrier,
            trackingNumber:
              cleanTrackingNumber,
          }),
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

      Alert.alert(
        'Could not mark as shipped',
        error instanceof Error
          ? error.message
          : 'Please try again.',
      )
    } finally {
      setShipping(false)
    }
  }

  async function confirmDelivery() {
    if (
      !orderId ||
      order?.status !== 'delivered' ||
      isSeller
    ) {
      return
    }

    try {
      setConfirmingDelivery(true)

      const response = await fetch(
        `${API_URL}/api/orders/${orderId}/buyer-confirm`,
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
      setOrderReward(
        result.reward ?? null
      )
    } catch (error) {
      console.error(
        'TEFTE buyer confirm error:',
        error
      )

      Alert.alert(
        'Could not confirm delivery',
        error instanceof Error
          ? error.message
          : 'Please try again.',
      )
    } finally {
      setConfirmingDelivery(false)
    }
  }

  async function submitDispute() {
    if (
      !orderId ||
      order?.status !== 'delivered' ||
      isSeller
    ) {
      return
    }

    try {
      setDisputing(true)

      const response = await fetch(
        `${API_URL}/api/orders/${orderId}/buyer-dispute`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason:
              'Buyer opened a dispute from the TEFTE order screen',
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result?.error ||
            'Could not open dispute'
        )
      }

      setOrder(result.order)
    } catch (error) {
      console.error(
        'TEFTE dispute error:',
        error
      )

      Alert.alert(
        'Could not open dispute',
        error instanceof Error
          ? error.message
          : 'Please try again.',
      )
    } finally {
      setDisputing(false)
    }
  }

  function openDispute() {
    Alert.alert(
      'Open a dispute?',
      'Seller payment will be paused while the dispute is reviewed.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Open dispute',
          style: 'destructive',
          onPress: submitDispute,
        },
      ],
    )
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
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
                  : order?.status === 'delivered'
                    ? 'Delivered'
                    : order?.status === 'disputed'
                      ? 'Dispute opened'
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
                  ? 'Your order is on the way.'
                  : order?.status === 'delivered'
                    ? 'The carrier confirmed delivery. Your 48-hour protection window is active.'
                    : order?.status === 'disputed'
                      ? 'Seller payment is paused while this dispute is reviewed.'
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

        {isSkrOrder && !isSeller ? (
          <View style={styles.skrRewardCard}>
            {order?.status === 'completed' ? (
              <>
                <Text style={styles.skrRewardLabel}>
                  SKR REWARD UNLOCKED
                </Text>

                <Text style={styles.skrRewardXp}>
                  {orderReward
                    ? `+${orderReward.xpAwarded} TEFTE XP`
                    : 'TEFTE reward earned'}
                </Text>

                <Text style={styles.skrRewardText}>
                  {orderReward?.listingBoostsAwarded
                    ? `+${orderReward.listingBoostsAwarded} Listing Boost`
                    : 'Reward saved to your TEFTE profile'}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.skrRewardLabel}>
                  SKR REWARDS PENDING
                </Text>

                <Text style={styles.skrRewardText}>
                  Rewards unlock only after the order is completed.
                </Text>
              </>
            )}
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
            After the carrier confirms delivery,
            the buyer has 48 hours to confirm the
            item or open a dispute. If no dispute
            is opened, TEFTE completes the order
            automatically.
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
                {order?.trackingNumber
                  ? `${getCarrierLabel(order.carrier)} · ${order.trackingNumber}`
                  : 'Seller ships the item'}
              </Text>
            </View>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.step}>
            <View
              style={[
                styles.stepCircle,
                orderDelivered &&
                  styles.stepCircleActive,
              ]}
            >
              <Text
                style={
                  orderDelivered
                    ? styles.stepCheck
                    : styles.stepNumber
                }
              >
                {orderDelivered ? 'OK' : '4'}
              </Text>
            </View>

            <View style={styles.stepContent}>
              <Text
                style={
                  orderDelivered
                    ? styles.stepTitleActive
                    : styles.stepTitle
                }
              >
                Delivered
              </Text>

              <Text style={styles.stepDescription}>
                Carrier confirms delivery
              </Text>
            </View>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.step}>
            <View
              style={[
                styles.stepCircle,
                (order?.status === 'delivered' ||
                  orderDisputed ||
                  orderCompleted) &&
                  styles.stepCircleActive,
              ]}
            >
              <Text
                style={
                  order?.status === 'delivered' ||
                  orderDisputed ||
                  orderCompleted
                    ? styles.stepCheck
                    : styles.stepNumber
                }
              >
                {orderCompleted
                  ? 'OK'
                  : orderDisputed
                    ? '!'
                    : '5'}
              </Text>
            </View>

            <View style={styles.stepContent}>
              <Text
                style={
                  order?.status === 'delivered' ||
                  orderDisputed ||
                  orderCompleted
                    ? styles.stepTitleActive
                    : styles.stepTitle
                }
              >
                {orderDisputed
                  ? 'Dispute opened'
                  : orderCompleted
                    ? 'Protection complete'
                    : '48h protection'}
              </Text>

              <Text style={styles.stepDescription}>
                {orderDisputed
                  ? 'Seller payment is paused'
                  : order?.status === 'delivered'
                    ? `${protectionTimeLabel} remaining`
                    : orderCompleted
                      ? 'Buyer confirmed or timer ended'
                      : 'Starts after delivery'}
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
                {orderCompleted ? 'OK' : '6'}
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

        {order?.trackingNumber ? (
          <View style={styles.trackingCard}>
            <View style={styles.trackingHeader}>
              <Text style={styles.trackingTitle}>
                Delivery tracking
              </Text>

              <View style={styles.trackingStatusPill}>
                <Text style={styles.trackingStatusText}>
                  {order.status === 'delivered' ||
                  order.status === 'disputed' ||
                  order.status === 'completed'
                    ? 'DELIVERED'
                    : 'IN TRANSIT'}
                </Text>
              </View>
            </View>

            <Text style={styles.trackingCarrier}>
              {getCarrierLabel(order.carrier)}
            </Text>

            <Text style={styles.trackingNumber}>
              {order.trackingNumber}
            </Text>

            <Text style={styles.trackingHint}>
              TEFTE will use the carrier status to confirm delivery.
            </Text>
          </View>
        ) : null}

        {signature ? (
          <View style={styles.transactionCard}>
            <Text style={styles.transactionLabel}>
              {isSkrOrder ? 'SKR demo reference' : 'Solana transaction'}
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
                  ? 'The order is on the way. TEFTE will start the 48-hour protection window only after the carrier confirms delivery.'
                  : order?.status === 'delivered'
                    ? isSeller
                      ? `Delivery is confirmed. Buyer protection ends in ${protectionTimeLabel}.`
                      : `Delivery is confirmed. Confirm the item or open a dispute within ${protectionTimeLabel}.`
                    : order?.status === 'disputed'
                      ? 'The dispute is open. Seller payment is paused until the dispute is resolved.'
                      : order?.status === 'completed'
                        ? order?.completionReason === 'auto_completed_after_48h'
                          ? 'The 48-hour protection window ended with no dispute, so the order was completed automatically.'
                          : 'This TEFTE deal is complete.'
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

        {order?.status === 'delivered' &&
        !isSeller ? (
          <View style={styles.buyerDeliveryActions}>
            <Pressable
              style={styles.confirmButton}
              onPress={confirmDelivery}
              disabled={
                confirmingDelivery || disputing
              }
            >
              <Text style={styles.confirmButtonText}>
                {confirmingDelivery
                  ? 'Confirming...'
                  : 'Confirm received'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.disputeButton}
              onPress={openDispute}
              disabled={
                confirmingDelivery || disputing
              }
            >
              <Text style={styles.disputeButtonText}>
                {disputing
                  ? 'Opening dispute...'
                  : 'Open dispute'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {order?.status === 'confirmed' &&
        isSeller ? (
          <View style={styles.shippingForm}>
            <Text style={styles.shippingFormTitle}>
              Delivery details
            </Text>

            <Text style={styles.shippingFormHint}>
              Choose the carrier and enter the tracking number before marking the order as shipped.
            </Text>

            <View style={styles.carrierOptions}>
              {CARRIERS.map((carrier) => {
                const selected =
                  selectedCarrier === carrier.code

                return (
                  <Pressable
                    key={carrier.code}
                    style={[
                      styles.carrierOption,
                      selected &&
                        styles.carrierOptionSelected,
                    ]}
                    onPress={() =>
                      setSelectedCarrier(
                        carrier.code,
                      )
                    }
                    disabled={shipping}
                  >
                    <Text
                      style={[
                        styles.carrierOptionText,
                        selected &&
                          styles.carrierOptionTextSelected,
                      ]}
                    >
                      {carrier.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <TextInput
              style={styles.trackingInput}
              value={trackingInput}
              onChangeText={setTrackingInput}
              placeholder="Tracking number / TTN"
              placeholderTextColor="#999999"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!shipping}
              maxLength={64}
              onFocus={() => {
                setTimeout(() => {
                  scrollRef.current?.scrollToEnd({
                    animated: true,
                  })
                }, 180)
              }}
            />

            <Pressable
              style={[
                styles.confirmButton,
                trackingInput.trim().length < 5 &&
                  styles.confirmButtonDisabled,
              ]}
              onPress={markAsShipped}
              disabled={
                shipping ||
                trackingInput.trim().length < 5
              }
            >
              <Text style={styles.confirmButtonText}>
                {shipping
                  ? 'Saving shipment...'
                  : 'Mark as shipped'}
              </Text>
            </Pressable>
          </View>
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
          {'Paid > Seller confirmed > Shipped > Delivered > 48h protection > Seller paid'}
        </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
  shippingForm: {
    marginTop: 4,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },

  shippingFormTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
  },

  shippingFormHint: {
    marginTop: 5,
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 17,
    color: '#6F6F6F',
  },

  carrierOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },

  carrierOption: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDDDD8',
    backgroundColor: '#F7F7F4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  carrierOptionSelected: {
    borderColor: '#111111',
    backgroundColor: '#111111',
  },

  carrierOptionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#555555',
  },

  carrierOptionTextSelected: {
    color: '#FFFFFF',
  },

  trackingInput: {
    minHeight: 50,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDDDD8',
    backgroundColor: '#FAFAF8',
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },

  confirmButtonDisabled: {
    opacity: 0.45,
  },

  trackingCard: {
    marginTop: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  trackingTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
  },

  trackingStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#ECFDF3',
  },

  trackingStatusText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#15803D',
  },

  trackingCarrier: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '800',
    color: '#666666',
  },

  trackingNumber: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
  },

  trackingHint: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: '#777777',
  },

  buyerDeliveryActions: {
    gap: 10,
    marginTop: 4,
  },

  disputeButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D92D20',
  },

  disputeButtonText: {
    color: '#B42318',
    fontSize: 15,
    fontWeight: '700',
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

  keyboardAvoider: {
    flex: 1,
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




































