import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import * as ImagePicker from 'expo-image-picker'

const API_URL = 'http://192.168.68.55:3000'

type ListingStatus = 'active' | 'sold'

type EditPhoto = {
  id: string
  uri: string
  existingPath?: string
  isNew?: boolean
}

type Product = {
  id: string
  title: string
  description?: string
  price: number
  currency?: string
  category?: string
  condition?: string
  seller?: string
  userListing?: boolean
  status?: ListingStatus
  imageUrl?: string | null
  imageUrls?: string[]
}

type OrderStatus =
  | 'waiting_seller'
  | 'confirmed'
  | 'declined_by_seller'
  | 'cancelled_by_buyer'
  | 'shipped'
  | 'received'
  | 'completed'

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
  status: OrderStatus
  createdAt: string
  updatedAt: string
}
function getProductImage(product: Product) {
  const rawImage =
    product.imageUrls?.find((image) => Boolean(image)) || product.imageUrl

  if (!rawImage) {
    return null
  }

  if (rawImage.startsWith('http://') || rawImage.startsWith('https://')) {
    return rawImage
  }

  return `${API_URL}${rawImage}`
}

function shortAddress(address?: string) {
  if (!address) {
    return ''
  }

  if (address.length <= 12) {
    return address
  }

  return `${address.slice(0, 5)}...${address.slice(-5)}`
}

export default function ProfileScreen() {
  const router = useRouter()
  const { account, connect } = useMobileWallet()

  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)

  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editCondition, setEditCondition] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editPhotos, setEditPhotos] = useState<EditPhoto[]>([])

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/orders`
      )

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        )
      }

      const data = await response.json()

      const loadedOrders: Order[] =
        Array.isArray(data?.orders)
          ? data.orders
          : []

      setOrders(loadedOrders)
    } catch (err) {
      console.error(
        'Profile orders error:',
        err
      )
    }
  }, [])
  const loadProducts = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError('')

      const response = await fetch(`${API_URL}/api/products`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      const allProducts: Product[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.products)
          ? data.products
          : []

      const myProducts = allProducts.filter(
        (product) =>
          product.userListing === true || product.id?.startsWith('user-'),
      )

      setProducts(myProducts)
    } catch (err) {
      console.error('Profile products error:', err)
      setError('Could not load your listings.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadProducts()
      loadOrders()
    }, [loadProducts, loadOrders]),
  )

  const openEdit = (product: Product) => {
    setEditingProduct(product)
    setEditTitle(product.title)
    setEditPrice(String(product.price))
    setEditCategory(product.category || '')
    setEditCondition(product.condition || '')
    setEditDescription(product.description || '')

    const rawPhotos =
      product.imageUrls?.length
        ? product.imageUrls
        : product.imageUrl
          ? [product.imageUrl]
          : []

    setEditPhotos(
      rawPhotos.map((photo, index) => ({
        id: `existing-${index}-${photo}`,
        uri:
          photo.startsWith('http://') || photo.startsWith('https://')
            ? photo
            : `${API_URL}${photo}`,
        existingPath:
          photo.startsWith(API_URL)
            ? photo.slice(API_URL.length)
            : photo,
      })),
    )
  }

  const closeEdit = () => {
    if (savingEdit) {
      return
    }

    setEditingProduct(null)
  }

  const addEditPhotos = async () => {
    if (editPhotos.length >= 8) {
      Alert.alert('Photo limit', 'You can add up to 8 photos.')
      return
    }

    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      Alert.alert(
        'Photo permission needed',
        'Please allow TEFTE to access your photos.',
      )
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: 8 - editPhotos.length,
    })

    if (result.canceled) {
      return
    }

    const availableSlots = 8 - editPhotos.length

    const selected = result.assets
      .slice(0, availableSlots)
      .map((asset, index) => ({
        id: `new-${Date.now()}-${index}`,
        uri: asset.uri,
        isNew: true,
      }))

    setEditPhotos((current) => [...current, ...selected])
  }

  const removeEditPhoto = (id: string) => {
    if (editPhotos.length <= 1) {
      Alert.alert(
        'Photo required',
        'A TEFTE listing must have at least one photo.',
      )
      return
    }

    setEditPhotos((current) =>
      current.filter((photo) => photo.id !== id),
    )
  }

  const moveEditPhoto = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction

    if (nextIndex < 0 || nextIndex >= editPhotos.length) {
      return
    }

    setEditPhotos((current) => {
      const next = [...current]
      const [photo] = next.splice(index, 1)
      next.splice(nextIndex, 0, photo)
      return next
    })
  }

  const saveEdit = async () => {
    if (!editingProduct) {
      return
    }

    const title = editTitle.trim()
    const numericPrice = Number(editPrice.replace(',', '.'))

    if (!title) {
      Alert.alert('Title required', 'Please enter a product title.')
      return
    }

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      Alert.alert('Invalid price', 'Please enter a valid product price.')
      return
    }

    if (editPhotos.length === 0) {
      Alert.alert(
        'Photo required',
        'A TEFTE listing must have at least one photo.',
      )
      return
    }

    try {
      setSavingEdit(true)

      const formData = new FormData()

      formData.append('title', title)
      formData.append('price', String(numericPrice))
      formData.append('category', editCategory.trim())
      formData.append('condition', editCondition.trim())
      formData.append('description', editDescription.trim())

      const existingImages = editPhotos
        .filter((photo) => !photo.isNew && photo.existingPath)
        .map((photo) => photo.existingPath as string)

      formData.append(
        'existingImages',
        JSON.stringify(existingImages),
      )

      editPhotos
        .filter((photo) => photo.isNew)
        .forEach((photo, index) => {
          formData.append(
            'images',
            {
              uri: photo.uri,
              name: `tefte-edit-${Date.now()}-${index}.jpg`,
              type: 'image/jpeg',
            } as any,
          )
        })

      const response = await fetch(
        `${API_URL}/api/products/${editingProduct.id}`,
        {
          method: 'PATCH',
          body: formData,
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Could not update listing.')
      }

      setProducts((current) =>
        current.map((product) =>
          product.id === editingProduct.id
            ? {
                ...product,
                ...data.product,
              }
            : product,
        ),
      )

      setEditingProduct(null)

      Alert.alert('Saved', 'Your TEFTE listing has been updated.')
    } catch (err) {
      console.error('Edit listing error:', err)

      Alert.alert(
        'Could not save',
        err instanceof Error ? err.message : 'Please try again.',
      )
    } finally {
      setSavingEdit(false)
    }
  }

  const changeStatus = async (
    product: Product,
    nextStatus: ListingStatus,
  ) => {
    try {
      setActionId(product.id)

      const response = await fetch(`${API_URL}/api/products/${product.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Could not update listing.')
      }

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                ...data.product,
              }
            : item,
        ),
      )
    } catch (err) {
      console.error('Listing status error:', err)

      Alert.alert(
        'Could not update listing',
        err instanceof Error ? err.message : 'Please try again.',
      )
    } finally {
      setActionId(null)
    }
  }

  const askChangeStatus = (product: Product) => {
    const currentStatus: ListingStatus = product.status || 'active'
    const nextStatus: ListingStatus =
      currentStatus === 'sold' ? 'active' : 'sold'

    Alert.alert(
      nextStatus === 'sold' ? 'Mark as sold?' : 'Make active again?',
      nextStatus === 'sold'
        ? `${product.title} will remain in your profile with Sold status.`
        : `${product.title} will return to Active status.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: nextStatus === 'sold' ? 'Mark as sold' : 'Make active',
          onPress: () => changeStatus(product, nextStatus),
        },
      ],
    )
  }

  const deleteProduct = async (product: Product) => {
    try {
      setActionId(product.id)

      const response = await fetch(`${API_URL}/api/products/${product.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Could not delete listing.')
      }

      setProducts((current) =>
        current.filter((item) => item.id !== product.id),
      )
    } catch (err) {
      console.error('Delete listing error:', err)

      Alert.alert(
        'Could not delete listing',
        err instanceof Error ? err.message : 'Please try again.',
      )
    } finally {
      setActionId(null)
    }
  }

  const askDelete = (product: Product) => {
    Alert.alert(
      'Delete listing?',
      `${product.title} will be permanently removed from TEFTE.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteProduct(product),
        },
      ],
    )
  }

  const walletAddress = account?.address?.toString()
  const myPurchases = orders.filter(
    (order) =>
      Boolean(walletAddress) &&
      order.buyer === walletAddress,
  )

  const myProductIds = new Set(
    products.map((product) => product.id),
  )

  const mySales = orders.filter(
    (order) =>
      myProductIds.has(order.productId),
  )

  const activeCount = products.filter(
    (product) => (product.status || 'active') === 'active',
  ).length
  const soldCount = products.filter(
    (product) => product.status === 'sold',
  ).length

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadProducts(true)}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>TEFTE</Text>
            <Text style={styles.pageLabel}>Profile</Text>
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>T</Text>
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.bigAvatar}>
              <Text style={styles.bigAvatarText}>T</Text>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {account?.label || 'TEFTE Seller'}
              </Text>

              {account ? (
                <>
                  <View style={styles.connectedRow}>
                    <View style={styles.statusDot} />
                    <Text style={styles.connectedText}>
                      Seeker wallet connected
                    </Text>
                  </View>

                  {walletAddress ? (
                    <Text style={styles.walletAddress}>
                      {shortAddress(walletAddress)}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.profileSubtitle}>
                  Connect your Seeker wallet to build your TEFTE identity.
                </Text>
              )}
            </View>
          </View>

          {!account ? (
            <Pressable style={styles.connectButton} onPress={connect}>
              <Text style={styles.connectButtonText}>Connect wallet</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Tefte Trust</Text>

        <View style={styles.trustCard}>
          <View style={styles.trustScore}>
            <Text style={styles.trustNumber}>New</Text>
            <Text style={styles.trustLabel}>Seller status</Text>
          </View>

          <View style={styles.trustDivider} />

          <View style={styles.trustScore}>
            <Text style={styles.trustNumber}>{activeCount}</Text>
            <Text style={styles.trustLabel}>Active</Text>
          </View>

          <View style={styles.trustDivider} />

          <View style={styles.trustScore}>
            <Text style={styles.trustNumber}>{soldCount}</Text>
            <Text style={styles.trustLabel}>Sold</Text>
          </View>
        </View>

        <View style={styles.rewardCard}>
          <View style={styles.rewardIcon}>
            <Text style={styles.rewardEmoji}>РІСљВ¦</Text>
          </View>

          <View style={styles.rewardInfo}>
            <Text style={styles.rewardTitle}>TEFTE Rewards</Text>
            <Text style={styles.rewardText}>
              Use SKR in TEFTE to earn XP, boosts and mascot rewards.
            </Text>
          </View>

          <Text style={styles.comingSoon}>Soon</Text>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              My purchases
            </Text>
            <Text style={styles.sectionSubtitle}>
              Orders you placed on TEFTE
            </Text>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {myPurchases.length}
            </Text>
          </View>
        </View>

        {myPurchases.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.stateTitle}>
              No purchases yet
            </Text>
            <Text style={styles.stateText}>
              Your TEFTE orders will appear here.
            </Text>
          </View>
        ) : (
          myPurchases.map((order) => (
            <Pressable
              key={order.id}
              style={styles.orderCard}
              onPress={() =>
                router.push({
                  pathname: '/order/[id]',
                  params: {
                    id: order.productId,
                    orderId: order.id,
                    signature:
                      order.transactionSignature || '',
                  },
                })
              }
            >
              <View style={styles.orderCardInfo}>
                <Text
                  style={styles.orderCardTitle}
                  numberOfLines={2}
                >
                  {order.productTitle}
                </Text>

                <Text style={styles.orderCardPrice}>
                  {order.productPrice}{' '}
                  {order.productCurrency}
                </Text>
              </View>

              <View style={styles.orderStatusBadge}>
                <Text style={styles.orderStatusText}>
                  {order.status === 'waiting_seller'
                    ? 'Waiting for seller'
                    : order.status === 'confirmed'
                      ? 'Confirmed'
                      : order.status ===
                          'declined_by_seller'
                        ? 'Declined'
                        : order.status ===
                            'cancelled_by_buyer'
                          ? 'Cancelled'
                          : order.status === 'shipped'
                            ? 'Shipped'
                            : order.status === 'received'
                              ? 'Received'
                              : 'Completed'}
                </Text>
              </View>
            </Pressable>
          ))
        )}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Sales
            </Text>
            <Text style={styles.sectionSubtitle}>
              Orders placed on your listings
            </Text>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {mySales.length}
            </Text>
          </View>
        </View>

        {mySales.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.stateTitle}>
              No sales yet
            </Text>
            <Text style={styles.stateText}>
              Buyer orders for your listings will appear here.
            </Text>
          </View>
        ) : (
          mySales.map((order) => (
            <Pressable
              key={order.id}
              style={styles.orderCard}
              onPress={() =>
                router.push({
                  pathname: '/order/[id]',
                  params: {
                    id: order.productId,
                    orderId: order.id,
                    signature:
                      order.transactionSignature || '',
                    role: 'seller',
                  },
                })
              }
            >
              <View style={styles.orderCardInfo}>
                <Text
                  style={styles.orderCardTitle}
                  numberOfLines={2}
                >
                  {order.productTitle}
                </Text>

                <Text style={styles.orderCardPrice}>
                  {order.productPrice}{' '}
                  {order.productCurrency}
                </Text>
              </View>

              <View style={styles.orderStatusBadge}>
                <Text style={styles.orderStatusText}>
                  {order.status === 'waiting_seller'
                    ? 'Action needed'
                    : order.status === 'confirmed'
                      ? 'Confirmed'
                      : order.status ===
                          'declined_by_seller'
                        ? 'Declined'
                        : order.status ===
                            'cancelled_by_buyer'
                          ? 'Cancelled'
                          : order.status === 'shipped'
                            ? 'Shipped'
                            : order.status === 'received'
                              ? 'Received'
                              : 'Completed'}
                </Text>
              </View>
            </Pressable>
          ))
        )}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>My Listings</Text>
            <Text style={styles.sectionSubtitle}>
              Manage products you published on TEFTE
            </Text>
          </View>

          {!loading && !error ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{products.length}</Text>
            </View>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="small" />
            <Text style={styles.stateText}>Loading your listings...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>Could not load listings</Text>
            <Text style={styles.stateText}>{error}</Text>

            <Pressable
              style={styles.retryButton}
              onPress={() => loadProducts()}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>СЂСџвЂњВ¦</Text>
            <Text style={styles.emptyTitle}>No listings yet</Text>
            <Text style={styles.emptyText}>
              Take a few photos and let TEFTE AI help create your first
              listing.
            </Text>

            <Pressable
              style={styles.sellButton}
              onPress={() => router.push('/(tabs)/sell')}
            >
              <Text style={styles.sellButtonText}>Sell an item</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {products.map((product) => {
              const image = getProductImage(product)
              const status: ListingStatus = product.status || 'active'
              const busy = actionId === product.id

              return (
                <View key={product.id} style={styles.productCard}>
                  <Pressable
                    style={styles.productMain}
                    onPress={() =>
                      router.push({
                        pathname: '/product/[id]',
                        params: { id: product.id },
                      })
                    }
                  >
                    {image ? (
                      <Image
                        source={{ uri: image }}
                        style={[
                          styles.productImage,
                          status === 'sold' && styles.soldImage,
                        ]}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.productPlaceholder}>
                        <Text style={styles.placeholderLogo}>TEFTE</Text>
                        <Text style={styles.placeholderText}>No photo</Text>
                      </View>
                    )}

                    <View style={styles.productInfo}>
                      <View
                        style={[
                          styles.statusBadge,
                          status === 'sold'
                            ? styles.soldBadge
                            : styles.activeBadge,
                        ]}
                      >
                        <View
                          style={[
                            styles.statusBadgeDot,
                            status === 'sold'
                              ? styles.soldDot
                              : styles.activeDot,
                          ]}
                        />

                        <Text
                          style={[
                            styles.statusBadgeText,
                            status === 'sold'
                              ? styles.soldText
                              : styles.activeText,
                          ]}
                        >
                          {status === 'sold' ? 'Sold' : 'Active'}
                        </Text>
                      </View>

                      <Text style={styles.productTitle} numberOfLines={2}>
                        {product.title}
                      </Text>

                      <Text style={styles.productMeta} numberOfLines={1}>
                        {[product.category, product.condition]
                          .filter(Boolean)
                          .join(' Р’В· ')}
                      </Text>

                      <View style={styles.productBottom}>
                        <Text style={styles.productPrice}>
                          {product.price} {product.currency || 'USDC'}
                        </Text>

                        <Text style={styles.arrow}>РІвЂ вЂ™</Text>
                      </View>
                    </View>
                  </Pressable>

                  <View style={styles.controls}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.controlButton,
                        pressed && styles.controlPressed,
                      ]}
                      disabled={busy}
                      onPress={() => openEdit(product)}
                    >
                      <Text style={styles.controlButtonText}>Edit</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.controlButton,
                        pressed && styles.controlPressed,
                      ]}
                      disabled={busy}
                      onPress={() => askChangeStatus(product)}
                    >
                      <Text style={styles.controlButtonText}>
                        {busy
                          ? 'Working...'
                          : status === 'sold'
                            ? 'Make active'
                            : 'Mark as sold'}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && styles.controlPressed,
                      ]}
                      disabled={busy}
                      onPress={() => askDelete(product)}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal
        visible={Boolean(editingProduct)}
        transparent
        animationType="slide"
        onRequestClose={closeEdit}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit listing</Text>
                <Text style={styles.modalSubtitle}>
                  Update your TEFTE product
                </Text>
              </View>

              <Pressable
                style={styles.closeButton}
                onPress={closeEdit}
                disabled={savingEdit}
              >
                <Text style={styles.closeButtonText}>X</Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.editPhotoHeader}>
                <View>
                  <Text style={styles.inputLabel}>Photos</Text>
                  <Text style={styles.editPhotoHint}>
                    First photo is the main photo {editPhotos.length}/8
                  </Text>
                </View>

                {editPhotos.length < 8 ? (
                  <Pressable
                    style={styles.addPhotoButton}
                    onPress={addEditPhotos}
                    disabled={savingEdit}
                  >
                    <Text style={styles.addPhotoButtonText}>+ Add photos</Text>
                  </Pressable>
                ) : null}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.editPhotoRow}
              >
                {editPhotos.map((photo, index) => (
                  <View key={photo.id} style={styles.editPhotoCard}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.editPhotoImage}
                      resizeMode="cover"
                    />

                    {index === 0 ? (
                      <View style={styles.mainPhotoBadge}>
                        <Text style={styles.mainPhotoBadgeText}>MAIN</Text>
                      </View>
                    ) : null}

                    <Pressable
                      style={styles.removePhotoButton}
                      onPress={() => removeEditPhoto(photo.id)}
                      disabled={savingEdit}
                    >
                      <Text style={styles.removePhotoButtonText}>X</Text>
                    </Pressable>

                    <View style={styles.photoMoveRow}>
                      <Pressable
                        style={[
                          styles.photoMoveButton,
                          index === 0 && styles.photoMoveDisabled,
                        ]}
                        disabled={savingEdit || index === 0}
                        onPress={() => moveEditPhoto(index, -1)}
                      >
                        <Text style={styles.photoMoveText}>{'<'}</Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.photoMoveButton,
                          index === editPhotos.length - 1 &&
                            styles.photoMoveDisabled,
                        ]}
                        disabled={
                          savingEdit ||
                          index === editPhotos.length - 1
                        }
                        onPress={() => moveEditPhoto(index, 1)}
                      >
                        <Text style={styles.photoMoveText}>{'>'}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.input}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Product title"
                placeholderTextColor="#999999"
              />

              <Text style={styles.inputLabel}>Price</Text>
              <TextInput
                style={styles.input}
                value={editPrice}
                onChangeText={setEditPrice}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#999999"
              />

              <Text style={styles.inputLabel}>Category</Text>
              <TextInput
                style={styles.input}
                value={editCategory}
                onChangeText={setEditCategory}
                placeholder="Category"
                placeholderTextColor="#999999"
              />

              <Text style={styles.inputLabel}>Condition</Text>
              <TextInput
                style={styles.input}
                value={editCondition}
                onChangeText={setEditCondition}
                placeholder="Condition"
                placeholderTextColor="#999999"
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.descriptionInput]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Describe your product"
                placeholderTextColor="#999999"
                multiline
                textAlignVertical="top"
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={closeEdit}
                  disabled={savingEdit}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.saveButton,
                    savingEdit && styles.disabledButton,
                  ]}
                  onPress={saveEdit}
                  disabled={savingEdit}
                >
                  {savingEdit ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save changes</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  orderCardInfo: {
    flex: 1,
  },

  orderCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 5,
  },

  orderCardPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555555',
  },

  orderStatusBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  orderStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#444444',
  },
  screen: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  logo: {
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -1.2,
    color: '#111111',
  },

  pageLabel: {
    marginTop: 1,
    fontSize: 13,
    color: '#777777',
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  profileCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    marginBottom: 26,
  },

  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  bigAvatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#EEEDE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  bigAvatarText: {
    fontSize: 27,
    fontWeight: '900',
    color: '#111111',
  },

  profileInfo: {
    flex: 1,
  },

  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
  },

  profileSubtitle: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
    color: '#777777',
  },

  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#36A269',
    marginRight: 6,
  },

  connectedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4D4D4D',
  },

  walletAddress: {
    marginTop: 4,
    fontSize: 12,
    color: '#999999',
  },

  connectButton: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },

  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111111',
  },

  sectionSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: '#888888',
  },

  trustCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 8,
    marginTop: 11,
    marginBottom: 12,
  },

  trustScore: {
    flex: 1,
    alignItems: 'center',
  },

  trustNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111111',
  },

  trustLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#888888',
  },

  trustDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#ECECE8',
  },

  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEEDE8',
    borderRadius: 22,
    padding: 15,
    marginBottom: 28,
  },

  rewardIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  rewardEmoji: {
    fontSize: 22,
    color: '#111111',
  },

  rewardInfo: {
    flex: 1,
  },

  rewardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
  },

  rewardText: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: '#666666',
  },

  comingSoon: {
    marginLeft: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#777777',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  countBadge: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 9,
    borderRadius: 16,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },

  countText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  stateBox: {
    minHeight: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  stateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 5,
  },

  stateText: {
    marginTop: 9,
    fontSize: 13,
    color: '#777777',
    textAlign: 'center',
  },

  retryButton: {
    marginTop: 15,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#111111',
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 26,
    alignItems: 'center',
  },

  emptyEmoji: {
    fontSize: 34,
  },

  emptyTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
  },

  emptyText: {
    marginTop: 6,
    maxWidth: 290,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: '#777777',
  },

  sellButton: {
    marginTop: 17,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 15,
    backgroundColor: '#111111',
  },

  sellButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  list: {
    gap: 14,
  },

  productCard: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },

  productMain: {
    flexDirection: 'row',
    minHeight: 132,
    padding: 10,
  },

  productImage: {
    width: 112,
    height: 112,
    borderRadius: 16,
    backgroundColor: '#EEEDE8',
  },

  soldImage: {
    opacity: 0.55,
  },

  productPlaceholder: {
    width: 112,
    height: 112,
    borderRadius: 16,
    backgroundColor: '#EEEDE8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderLogo: {
    fontSize: 15,
    fontWeight: '900',
    color: '#333333',
  },

  placeholderText: {
    marginTop: 4,
    fontSize: 10,
    color: '#888888',
  },

  productInfo: {
    flex: 1,
    paddingLeft: 13,
    paddingVertical: 2,
  },

  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 7,
  },

  activeBadge: {
    backgroundColor: '#EEF7F1',
  },

  soldBadge: {
    backgroundColor: '#F0F0F0',
  },

  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  activeDot: {
    backgroundColor: '#36A269',
  },

  soldDot: {
    backgroundColor: '#777777',
  },

  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  activeText: {
    color: '#367A51',
  },

  soldText: {
    color: '#666666',
  },

  productTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    color: '#111111',
  },

  productMeta: {
    marginTop: 4,
    fontSize: 11,
    color: '#888888',
  },

  productBottom: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  productPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
  },

  arrow: {
    fontSize: 20,
    color: '#777777',
  },

  controls: {
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },

  controlButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 13,
    backgroundColor: '#F1F1EE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  controlButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#222222',
    textAlign: 'center',
  },

  deleteButton: {
    minWidth: 67,
    minHeight: 40,
    borderRadius: 13,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  deleteButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B33A3A',
  },

  controlPressed: {
    opacity: 0.6,
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  modalCard: {
    maxHeight: '88%',
    backgroundColor: '#F7F7F5',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 28,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111111',
  },

  modalSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#777777',
  },

  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeButtonText: {
    marginTop: -2,
    fontSize: 27,
    fontWeight: '400',
    color: '#111111',
  },

  editPhotoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },

  editPhotoHint: {
    marginTop: 2,
    fontSize: 11,
    color: '#888888',
  },

  addPhotoButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },

  addPhotoButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  editPhotoRow: {
    gap: 10,
    paddingBottom: 18,
  },

  editPhotoCard: {
    width: 126,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 6,
  },

  editPhotoImage: {
    width: 114,
    height: 114,
    borderRadius: 12,
    backgroundColor: '#EEEDE8',
  },

  mainPhotoBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#111111',
  },

  mainPhotoBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  removePhotoButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  removePhotoButtonText: {
    marginTop: -2,
    fontSize: 20,
    lineHeight: 22,
    color: '#B33A3A',
  },

  photoMoveRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },

  photoMoveButton: {
    flex: 1,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#EEEDE8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  photoMoveDisabled: {
    opacity: 0.3,
  },

  photoMoveText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222222',
  },

  inputLabel: {
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#555555',
  },

  input: {
    minHeight: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    paddingHorizontal: 14,
    marginBottom: 14,
    fontSize: 15,
    color: '#111111',
  },

  descriptionInput: {
    minHeight: 115,
    paddingTop: 14,
    paddingBottom: 14,
  },

  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },

  cancelButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#E9E9E5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333333',
  },

  saveButton: {
    flex: 1.5,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  disabledButton: {
    opacity: 0.55,
  },

  bottomSpace: {
    height: 30,
  },
})










