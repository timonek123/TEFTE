import { useEffect, useState } from 'react'
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router'
import bs58 from 'bs58'
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
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

type Product = {
  id: string
  title: string
  price: number
  currency: string
  seller?: string
  imageUrl?: string
  images?: string[]
}

type PaymentMethod =
  | 'SOL'
  | 'USDC'
  | 'USDT'
  | 'SKR'

const API_URL = 'http://192.168.68.55:3000'

const SELLER_ADDRESS = address(
  'GqozyB3iStZU8kW5T1wdPWq8YnGX4XKd7TC9Zs5xTmMw'
)

export default function CheckoutScreen() {
  const router = useRouter()

  const {
    account,
    client,
    getTransactionSigner,
    signAndSendTransactions,
  } = useMobileWallet()

  const [paying, setPaying] = useState(false)

  const params =
    useLocalSearchParams<{ id: string }>()

  const id = Array.isArray(params.id)
    ? params.id[0]
    : params.id

  const [product, setProduct] =
    useState<Product | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('SOL')

  useEffect(() => {
    async function loadProduct() {
      if (!id) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch(
          `${API_URL}/api/products`
        )

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          )
        }

        const products: Product[] =
          await response.json()

        const foundProduct =
          products.find(
            (item) => item.id === id
          ) ?? null

        setProduct(foundProduct)
      } catch (error) {
        console.error(
          'TEFTE checkout product error:',
          error
        )
      } finally {
        setLoading(false)
      }
    }

    loadProduct()
  }, [id])

  function getImageUrl(
    imageUrl?: string
  ) {
    if (!imageUrl) {
      return undefined
    }

    if (
      imageUrl.startsWith('http://') ||
      imageUrl.startsWith('https://')
    ) {
      return imageUrl
    }

    return `${API_URL}${imageUrl}`
  }

  function getMainImage() {
    if (!product) {
      return undefined
    }

    const image =
      product.images?.[0] ??
      product.imageUrl

    return getImageUrl(image)
  }

  async function continueToPayment() {
    if (!product) {
      return
    }

    if (
      paymentMethod !== 'SOL' &&
      paymentMethod !== 'SKR'
    ) {
      return
    }

    if (!account) {
      console.error(
        'TEFTE payment error: wallet is not connected'
      )
      return
    }

    if (paying) {
      return
    }

    try {
      setPaying(true)
      if (paymentMethod === 'SKR') {
        const transactionSignature =
          `SKR-DEMO-${Date.now()}`

        const orderResponse = await fetch(
          `${API_URL}/api/orders`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              productId: product.id,
              buyer: account.address,
              seller: product.seller,
              paymentMethod: 'SKR',
              transactionSignature,
            }),
          }
        )

        if (!orderResponse.ok) {
          throw new Error(
            'TEFTE could not create the SKR demo order'
          )
        }

        const orderResult =
          await orderResponse.json()

        router.replace({
          pathname: '/order/[id]',
          params: {
            id: product.id,
            orderId: orderResult.order.id,
            signature: transactionSignature,
            reward: 'skr-demo',
          },
        })

        return
      }

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
        'TEFTE checkout payment signature:',
        signature
      )

      const transactionSignature =
        bs58.encode(signature)

      const orderResponse = await fetch(
        `${API_URL}/api/orders`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId: product.id,
            buyer: account.address,
            seller: product.seller,
            paymentMethod: 'SOL',
            transactionSignature,
          }),
        }
      )

      if (!orderResponse.ok) {
        throw new Error(
          'Payment succeeded, but TEFTE could not create the order'
        )
      }

      const orderResult =
        await orderResponse.json()

      router.replace({
        pathname: '/order/[id]',
        params: {
          id: product.id,
          orderId: orderResult.order.id,
          signature: transactionSignature,
        },
      })
    } catch (error) {
      console.error(
        'TEFTE checkout payment error:',
        error
      )
    } finally {
      setPaying(false)
    }
  }
  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />

          <Text style={styles.loadingText}>
            Preparing checkout...
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
            Product not found
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

  const mainImage = getMainImage()

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.headerBack}
        >
          <Text style={styles.headerBackText}>
            вЂ№
          </Text>
        </Pressable>

        <Text style={styles.headerTitle}>
          Checkout
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={false}
      >
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
              <Text
                style={
                  styles.imagePlaceholderText
                }
              >
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

            <Text style={styles.seller}>
              Seller:{' '}
              {product.seller ??
                'crypton.skr'}
            </Text>

            <Text style={styles.price}>
              {product.price}{' '}
              {product.currency}
            </Text>
          </View>
        </View>

        <View style={styles.protectionCard}>
          <View
            style={styles.protectionIcon}
          >
            <Text
              style={
                styles.protectionIconText
              }
            >
              вњ“
            </Text>
          </View>

          <View style={styles.protectionText}>
            <Text
              style={styles.protectionTitle}
            >
              TEFTE Protection
            </Text>

            <Text
              style={
                styles.protectionDescription
              }
            >
              Your payment is protected
              while the order is being
              completed.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          Payment method
        </Text>

        <View style={styles.methods}>
          {(
            [
              'SOL',
              'USDC',
              'USDT',
              'SKR',
            ] as PaymentMethod[]
          ).map((method) => {
            const selected =
              paymentMethod === method

            const available =
              method === 'SOL' || method === 'SKR'

            return (
              <Pressable
                key={method}
                onPress={() =>
                  setPaymentMethod(method)
                }
                style={[
                  styles.method,
                  selected &&
                    styles.methodSelected,
                ]}
              >
                <View
                  style={[
                    styles.radio,
                    selected &&
                      styles.radioSelected,
                  ]}
                >
                  {selected ? (
                    <View
                      style={
                        styles.radioDot
                      }
                    />
                  ) : null}
                </View>

                <View style={styles.methodText}>
                  <Text
                    style={styles.methodName}
                  >
                    {method}
                  </Text>

                  <Text
                    style={
                      styles.methodDescription
                    }
                  >
                    {method === 'SKR'
                      ? 'SKR rewards - Demo preview'
                      : available
                        ? 'Available now'
                        : 'Coming next'}
                  </Text>
                </View>

                {method === 'SKR' ? (
                  <View style={styles.skrBadge}>
                    <Text
                      style={
                        styles.skrBadgeText
                      }
                    >
                      + XP
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            )
          })}
        </View>

        {paymentMethod === 'SKR' ? (
          <View style={styles.rewardCard}>
            <Text
              style={styles.rewardTitle}
            >
              Pay with SKR. Earn rewards.
            </Text>

            <Text
              style={styles.rewardText}
            >
              Earn TEFTE XP, unlock
              mascot rewards and receive
              marketplace perks.
            </Text>
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>
            Order summary
          </Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Item
            </Text>

            <Text style={styles.summaryValue}>
              {product.price}{' '}
              {product.currency}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              TEFTE Protection
            </Text>

            <Text style={styles.protectedText}>
              Included
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>
              Total
            </Text>

            <Text style={styles.totalValue}>
              {product.price}{' '}
              {product.currency}
            </Text>
          </View>
        </View>

        <View style={styles.flowCard}>
          <Text style={styles.flowTitle}>
            Protected transaction
          </Text>

          <Text style={styles.flowText}>
            Paid в†’ Shipped в†’ Received в†’
            Seller paid
          </Text>
        </View>

        <Pressable
          onPress={continueToPayment}
          disabled={
            (paymentMethod !== 'SOL' &&
              paymentMethod !== 'SKR') ||
            paying
          }
          style={[
            styles.payButton,
            ((paymentMethod !== 'SOL' &&
              paymentMethod !== 'SKR') ||
              paying) &&
              styles.payButtonDisabled,
          ]}
        >
          <Text style={styles.payButtonText}>
            {paymentMethod === 'SOL'
              ? paying
                ? 'Processing...'
                : 'Continue with SOL'
              : paymentMethod === 'SKR'
                ? paying
                  ? 'Processing...'
                  : 'Demo purchase with SKR'
                : `${paymentMethod} coming next`}
          </Text>
        </Pressable>

        <Text style={styles.footerText}>
          Blockchain stays under the hood.
          TEFTE keeps the experience simple.
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

  flex: {
    flex: 1,
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
    fontSize: 22,
    fontWeight: '800',
    color: '#111111',
  },

  backButton: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#111111',
  },

  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E7E2',
    backgroundColor: '#FFFFFF',
  },

  headerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerBackText: {
    fontSize: 36,
    lineHeight: 38,
    color: '#111111',
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111111',
  },

  headerSpacer: {
    width: 40,
  },

  content: {
    padding: 16,
    paddingBottom: 36,
  },

  productCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  productImage: {
    width: 92,
    height: 92,
    borderRadius: 15,
    backgroundColor: '#EEEEEA',
  },

  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  imagePlaceholderText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#999999',
  },

  productInfo: {
    flex: 1,
    paddingLeft: 14,
    justifyContent: 'center',
  },

  productTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    color: '#111111',
  },

  seller: {
    marginTop: 5,
    fontSize: 12,
    color: '#777777',
  },

  price: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
  },

  protectionCard: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#EAF7EE',
  },

  protectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },

  protectionIconText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  protectionText: {
    flex: 1,
    paddingLeft: 13,
  },

  protectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
  },

  protectionDescription: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: '#526058',
  },

  sectionTitle: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
  },

  methods: {
    gap: 9,
  },

  method: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E4E4DF',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },

  methodSelected: {
    borderWidth: 2,
    borderColor: '#111111',
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#BBBBB5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioSelected: {
    borderColor: '#111111',
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111111',
  },

  methodText: {
    flex: 1,
    marginLeft: 12,
  },

  methodName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
  },

  methodDescription: {
    marginTop: 2,
    fontSize: 11,
    color: '#888888',
  },

  skrBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#EEE8FF',
  },

  skrBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#6547A8',
  },

  rewardCard: {
    marginTop: 12,
    padding: 15,
    borderRadius: 17,
    backgroundColor: '#F1EDFF',
  },

  rewardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#332653',
  },

  rewardText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 17,
    color: '#665B7D',
  },

  summaryCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },

  summaryLabel: {
    fontSize: 13,
    color: '#777777',
  },

  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
  },

  protectedText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#356C45',
  },

  divider: {
    height: 1,
    marginVertical: 14,
    backgroundColor: '#E8E8E3',
  },

  totalLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
  },

  totalValue: {
    fontSize: 19,
    fontWeight: '900',
    color: '#111111',
  },

  flowCard: {
    marginTop: 14,
    padding: 15,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },

  flowTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111111',
  },

  flowText: {
    marginTop: 6,
    fontSize: 12,
    color: '#666666',
  },

  payButton: {
    marginTop: 20,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#111111',
  },

  payButtonDisabled: {
    opacity: 0.45,
  },

  payButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  footerText: {
    marginTop: 13,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
    color: '#999999',
  },
})











