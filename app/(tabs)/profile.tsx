import { API_URL } from '../../lib/api'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import * as ImagePicker from 'expo-image-picker'

type ListingStatus = 'active' | 'sold'

type ProfileSection = 'rewards' | 'purchases' | 'sales' | 'listings' | null

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
  sellerWallet?: string
  userListing?: boolean
  status?: ListingStatus
  imageUrl?: string | null
  imageUrls?: string[]
  boostedAt?: string | null
  boostedUntil?: string | null
  boostedBy?: string | null
}

type OrderStatus =
  | 'waiting_seller'
  | 'confirmed'
  | 'declined_by_seller'
  | 'cancelled_by_buyer'
  | 'shipped'
  | 'delivered'
  | 'disputed'
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

type RewardsAccount = {
  wallet: string
  xp: number
  listingBoosts: number
  completedSkrPurchases: number
  rewardedOrderIds?: string[]
  history?: Array<{
    orderId: string
    xpAwarded: number
    listingBoostsAwarded: number
    baseXp?: number
    spendBonusXp?: number
    awardedAt?: string
  }>
  updatedAt?: string | null
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

function isProductBoostActive(product: Product) {
  if (!product.boostedUntil) {
    return false
  }

  const boostedUntil =
    new Date(product.boostedUntil).getTime()

  return (
    Number.isFinite(boostedUntil) &&
    boostedUntil > Date.now() &&
    (product.status || 'active') === 'active'
  )
}

function getBoostTimeLabel(product: Product) {
  if (!isProductBoostActive(product) || !product.boostedUntil) {
    return ''
  }

  const remainingMs =
    new Date(product.boostedUntil).getTime() -
    Date.now()

  const remainingHours =
    Math.min(
      24,
      Math.max(
        1,
        Math.ceil(remainingMs / (60 * 60 * 1000)),
      ),
    )

  return `${remainingHours}h left`
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

const XP_LEVEL_THRESHOLDS = [0, 100, 300, 700, 1500]

function getXpLevel(xp: number) {
  let levelIndex = 0

  for (let index = XP_LEVEL_THRESHOLDS.length - 1; index >= 0; index -= 1) {
    if (xp >= XP_LEVEL_THRESHOLDS[index]) {
      levelIndex = index
      break
    }
  }

  const level = levelIndex + 1
  const currentThreshold = XP_LEVEL_THRESHOLDS[levelIndex]
  const nextThreshold = XP_LEVEL_THRESHOLDS[levelIndex + 1]

  if (nextThreshold === undefined) {
    return {
      level,
      currentThreshold,
      nextThreshold: null,
      progress: 1,
      xpToNext: 0,
    }
  }

  const levelRange = nextThreshold - currentThreshold
  const levelProgress = Math.max(0, xp - currentThreshold)

  return {
    level,
    currentThreshold,
    nextThreshold,
    progress: Math.min(1, levelProgress / levelRange),
    xpToNext: Math.max(0, nextThreshold - xp),
  }
}

export default function ProfileScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    section?: string
    editProductId?: string
    editRequest?: string
  }>()
  const handledEditRequest = useRef<string | null>(null)
  const { account, connect } = useMobileWallet()
  const walletAddress = account?.address?.toString()
  const sellerLabel = account?.label || ''

  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [serverRewards, setServerRewards] =
    useState<RewardsAccount | null>(null)
  const [openSection, setOpenSection] =
    useState<ProfileSection>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editCondition, setEditCondition] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editPhotos, setEditPhotos] = useState<EditPhoto[]>([])

  const loadProfile = useCallback(async () => {
    if (!walletAddress) {
      setAvatarUrl(null)
      return
    }

    try {
      const response = await fetch(
        `${API_URL}/api/profiles/${encodeURIComponent(walletAddress)}`
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const rawAvatar = data?.profile?.avatarUrl

      setAvatarUrl(
        typeof rawAvatar === 'string' && rawAvatar
          ? rawAvatar.startsWith('http://') || rawAvatar.startsWith('https://')
            ? rawAvatar
            : `${API_URL}${rawAvatar}`
          : null
      )
    } catch (err) {
      console.error('Profile avatar error:', err)
      setAvatarUrl(null)
    }
  }, [walletAddress])

  const uploadAvatar = useCallback(
    async (uri: string) => {
      if (!walletAddress || uploadingAvatar) {
        return
      }

      try {
        setUploadingAvatar(true)

        const formData = new FormData()
        formData.append(
          'avatar',
          {
            uri,
            name: 'tefte-avatar.jpg',
            type: 'image/jpeg',
          } as any
        )

        const response = await fetch(
          `${API_URL}/api/profiles/${encodeURIComponent(walletAddress)}/avatar`,
          {
            method: 'POST',
            body: formData,
          }
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.error || 'Could not upload avatar.')
        }

        const rawAvatar = data?.profile?.avatarUrl

        setAvatarUrl(
          typeof rawAvatar === 'string' && rawAvatar
            ? rawAvatar.startsWith('http://') || rawAvatar.startsWith('https://')
              ? rawAvatar
              : `${API_URL}${rawAvatar}`
            : null
        )

        Alert.alert(
          'Profile updated',
          'Your TEFTE avatar has been saved.'
        )
      } catch (err) {
        console.error('Avatar upload error:', err)

        Alert.alert(
          'Avatar upload failed',
          err instanceof Error
            ? err.message
            : 'Could not upload avatar.'
        )
      } finally {
        setUploadingAvatar(false)
      }
    },
    [walletAddress, uploadingAvatar],
  )

  const chooseAvatarFromGallery = useCallback(async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      Alert.alert(
        'Photo permission needed',
        'TEFTE needs access to your photos so you can choose a profile picture.'
      )
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]?.uri) {
      await uploadAvatar(result.assets[0].uri)
    }
  }, [uploadAvatar])

  const takeAvatarPhoto = useCallback(async () => {
    const permission =
      await ImagePicker.requestCameraPermissionsAsync()

    if (!permission.granted) {
      Alert.alert(
        'Camera permission needed',
        'TEFTE needs access to your camera so you can take a profile picture.'
      )
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]?.uri) {
      await uploadAvatar(result.assets[0].uri)
    }
  }, [uploadAvatar])

  const changeAvatar = useCallback(() => {
    if (!walletAddress || uploadingAvatar) {
      return
    }

    Alert.alert(
      'Profile photo',
      'Choose how you want to add your avatar.',
      [
        { text: 'Take photo', onPress: takeAvatarPhoto },
        { text: 'Choose from gallery', onPress: chooseAvatarFromGallery },
        { text: 'Cancel', style: 'cancel' },
      ]
    )
  }, [
    walletAddress,
    uploadingAvatar,
    takeAvatarPhoto,
    chooseAvatarFromGallery,
  ])

  const loadRewards = useCallback(async () => {
    if (!walletAddress) {
      setServerRewards(null)
      return
    }

    try {
      const response = await fetch(
        `${API_URL}/api/rewards/${encodeURIComponent(walletAddress)}`
      )

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        )
      }

      const data = await response.json()
      const raw = data?.rewards

      setServerRewards({
        wallet:
          typeof raw?.wallet === 'string'
            ? raw.wallet
            : walletAddress,
        xp: Math.max(
          0,
          Number(raw?.xp) || 0,
        ),
        listingBoosts: Math.max(
          0,
          Number(raw?.listingBoosts) || 0,
        ),
        completedSkrPurchases: Math.max(
          0,
          Number(raw?.completedSkrPurchases) || 0,
        ),
        rewardedOrderIds:
          Array.isArray(raw?.rewardedOrderIds)
            ? raw.rewardedOrderIds
            : [],
        history:
          Array.isArray(raw?.history)
            ? raw.history
            : [],
        updatedAt:
          typeof raw?.updatedAt === 'string'
            ? raw.updatedAt
            : null,
      })
    } catch (err) {
      console.error(
        'Profile rewards error:',
        err
      )

      setServerRewards(null)
    }
  }, [walletAddress])

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

      const myProducts = allProducts.filter((product) => {
        if (!walletAddress) {
          return false
        }

        if (product.sellerWallet) {
          return product.sellerWallet === walletAddress
        }

        return (
          product.userListing === true &&
          Boolean(sellerLabel) &&
          product.seller === sellerLabel
        )
      })

      setProducts(myProducts)
    } catch (err) {
      console.error('Profile products error:', err)
      setError('Could not load your listings.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [walletAddress, sellerLabel])

  useFocusEffect(
    useCallback(() => {
      loadProducts()
      loadOrders()
      loadRewards()
      loadProfile()
    }, [loadProducts, loadOrders, loadRewards, loadProfile]),
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

  useEffect(() => {
    if (params.section === 'listings') {
      setOpenSection('listings')
    }

    const editProductId =
      typeof params.editProductId === 'string'
        ? params.editProductId
        : ''

    const editRequest =
      typeof params.editRequest === 'string'
        ? params.editRequest
        : ''

    if (
      !editProductId ||
      !editRequest ||
      handledEditRequest.current === editRequest
    ) {
      return
    }

    const product = products.find(
      (item) => item.id === editProductId,
    )

    if (!product) {
      return
    }

    handledEditRequest.current = editRequest
    setOpenSection('listings')
    openEdit(product)
  }, [
    params.section,
    params.editProductId,
    params.editRequest,
    products,
  ])

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

  const boostListing = async (product: Product) => {
    if (!walletAddress) {
      Alert.alert(
        'Connect wallet',
        'Connect your wallet before using a Listing Boost.',
      )
      return
    }

    if ((product.status || 'active') !== 'active') {
      Alert.alert(
        'Listing is not active',
        'Only active listings can be boosted.',
      )
      return
    }

    if (isProductBoostActive(product)) {
      Alert.alert(
        'Already boosted',
        `This listing already has an active boost (${getBoostTimeLabel(product)}).`,
      )
      return
    }

    if (listingBoosts < 1) {
      Alert.alert(
        'No Listing Boosts',
        'Complete an eligible SKR purchase to earn a Listing Boost.',
      )
      return
    }

    setActionId(product.id)

    try {
      const response = await fetch(
        `${API_URL}/api/products/${encodeURIComponent(product.id)}/boost`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            wallet: walletAddress,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error || 'Could not boost listing.',
        )
      }

      if (data?.product) {
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
      }

      if (data?.rewards) {
        setServerRewards((current) => ({
          ...(current || {
            wallet: walletAddress,
            xp: 0,
            listingBoosts: 0,
            completedSkrPurchases: 0,
          }),
          ...data.rewards,
        }))
      } else {
        await loadRewards()
      }

      Alert.alert(
        'Listing boosted',
        'This listing is promoted for the next 24 hours.',
      )
    } catch (err) {
      console.error(
        'Boost listing error:',
        err,
      )

      Alert.alert(
        'Could not boost listing',
        err instanceof Error
          ? err.message
          : 'Please try again.',
      )
    } finally {
      setActionId(null)
    }
  }

  const askBoostListing = (product: Product) => {
    const title =
      product.title.length > 42
        ? `${product.title.slice(0, 39)}...`
        : product.title

    Alert.alert(
      'Use 1 Listing Boost?',
      `Boost "${title}" for 24 hours?\n\nAvailable boosts: ${listingBoosts}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Use Boost',
          onPress: () => boostListing(product),
        },
      ],
    )
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

  const myPurchases = orders.filter(
    (order) =>
      Boolean(walletAddress) &&
      order.buyer === walletAddress,
  )

  // Completed SKR rewards are authoritative on the server.
  // The client only uses orders to show whether an SKR purchase is still pending.
  const pendingSkrPurchases = myPurchases.filter(
    (order) =>
      order.paymentMethod?.trim().toUpperCase().includes('SKR') &&
      ![
        'completed',
        'declined_by_seller',
        'cancelled_by_buyer',
      ].includes(order.status),
  )

  const tefteXp = Math.max(
    0,
    serverRewards?.xp ?? 0,
  )

  const listingBoosts = Math.max(
    0,
    serverRewards?.listingBoosts ?? 0,
  )

  const completedSkrPurchases = Math.max(
    0,
    serverRewards?.completedSkrPurchases ?? 0,
  )

  const recentRewardHistory = [
    ...(serverRewards?.history ?? []),
  ]
    .sort(
      (a, b) =>
        new Date(b.awardedAt || 0).getTime() -
        new Date(a.awardedAt || 0).getTime(),
    )
    .slice(0, 3)

  const xpLevel = getXpLevel(tefteXp)
  const xpProgressPercent = `${Math.round(xpLevel.progress * 100)}%`

  const myProductIds = new Set(
    products.map((product) => product.id),
  )

  const mySales = orders.filter(
    (order) =>
      myProductIds.has(order.productId),
  )

  const salesActionNeededCount = mySales.filter(
    (order) => order.status === 'waiting_seller',
  ).length

  const activeCount = products.filter(
    (product) => (product.status || 'active') === 'active',
  ).length
  const soldCount = products.filter(
    (product) => product.status === 'sold',
  ).length

  const toggleSection = (section: Exclude<ProfileSection, null>) => {
    setOpenSection((current) =>
      current === section ? null : section,
    )
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              loadProducts(true)
              loadOrders()
              loadRewards()
              loadProfile()
            }}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>TEFTE</Text>
            <Text style={styles.pageLabel}>Profile</Text>
          </View>

          <Pressable
            style={styles.avatar}
            onPress={changeAvatar}
            disabled={!walletAddress || uploadingAvatar}
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.avatarText}>T</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <Pressable
              style={styles.bigAvatar}
              onPress={changeAvatar}
              disabled={!walletAddress || uploadingAvatar}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.bigAvatarImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.bigAvatarText}>T</Text>
              )}

              {walletAddress ? (
                <View style={styles.avatarEditBadge}>
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.avatarEditBadgeText}>+</Text>
                  )}
                </View>
              ) : null}
            </Pressable>

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
            <Text
              style={styles.trustLabel}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              Seller
            </Text>
          </View>

          <View style={styles.trustDivider} />

          <View style={styles.trustScore}>
            <Text style={styles.trustNumber}>{activeCount}</Text>
            <Text
              style={styles.trustLabel}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              Active
            </Text>
          </View>

          <View style={styles.trustDivider} />

          <View style={styles.trustScore}>
            <Text style={styles.trustNumber}>{soldCount}</Text>
            <Text
              style={styles.trustLabel}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              Sold
            </Text>
          </View>
        </View>

        <View style={styles.accordionSection}>
          <Pressable
            style={({ pressed }) => [
              styles.accordionHeader,
              pressed && styles.accordionPressed,
            ]}
            onPress={() => toggleSection('rewards')}
          >
            <View style={styles.accordionHeaderText}>
              <Text style={styles.accordionTitle}>TEFTE Rewards</Text>
              <Text style={styles.accordionSummary} numberOfLines={1}>
                Level {xpLevel.level} · {tefteXp} XP · {listingBoosts} Boosts
              </Text>
            </View>

            <View style={styles.accordionRight}>
              <View style={styles.compactRewardBadge}>
                <Text style={styles.compactRewardBadgeText}>
                  {completedSkrPurchases > 0
                    ? 'ACTIVE'
                    : pendingSkrPurchases.length > 0
                      ? 'PENDING'
                      : 'READY'}
                </Text>
              </View>

              <Text style={styles.accordionChevron}>
                {openSection === 'rewards' ? '⌃' : '⌄'}
              </Text>
            </View>
          </Pressable>

          {openSection === 'rewards' ? (
            <View style={styles.accordionBody}>
              <View style={styles.rewardsPanel}>
          <View style={styles.rewardHeader}>
            <Image
              source={require('../../assets/images/tefte-mascot.png')}
              style={styles.rewardMascot}
              resizeMode="contain"
            />

            <View style={styles.rewardInfo}>
              <Text style={styles.rewardTitle}>SKR purchase rewards</Text>
              <Text style={styles.rewardText}>
                Rewards unlock after an SKR order reaches Completed.
              </Text>
            </View>

            <View style={styles.rewardLiveBadge}>
              <Text style={styles.rewardLiveBadgeText}>
                {completedSkrPurchases > 0
                  ? 'ACTIVE'
                  : pendingSkrPurchases.length > 0
                    ? 'PENDING'
                    : 'READY'}
              </Text>
            </View>
          </View>

          <View style={styles.levelCard}>
            <View style={styles.levelTopRow}>
              <View>
                <Text style={styles.levelEyebrow}>TEFTE LEVEL</Text>
                <Text style={styles.levelTitle}>Level {xpLevel.level}</Text>
              </View>

              <Text style={styles.levelXp}>{tefteXp} XP</Text>
            </View>

            <View style={styles.levelTrack}>
              <View
                style={[
                  styles.levelFill,
                  { width: xpProgressPercent },
                ]}
              />
            </View>

            <View style={styles.levelBottomRow}>
              {xpLevel.nextThreshold === null ? (
                <Text style={styles.levelHint}>Maximum level reached</Text>
              ) : (
                <>
                  <Text
                    style={[styles.levelHint, styles.levelHintLeft]}
                    numberOfLines={1}
                  >
                    {xpLevel.xpToNext} XP → L{xpLevel.level + 1}
                  </Text>
                  <Text
                    style={styles.levelHint}
                    numberOfLines={1}
                  >
                    {xpLevel.currentThreshold}/{xpLevel.nextThreshold}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.rewardStats}>
            <View style={styles.rewardStat}>
              <Text style={styles.rewardStatValue}>{tefteXp}</Text>
              <Text
                style={styles.rewardStatLabel}
                numberOfLines={1}
                maxFontSizeMultiplier={1}
              >
                TEFTE XP
              </Text>
            </View>

            <View style={styles.rewardStatDivider} />

            <View style={styles.rewardStat}>
              <Text style={styles.rewardStatValue}>{listingBoosts}</Text>
              <Text
                style={styles.rewardStatLabel}
                numberOfLines={1}
                maxFontSizeMultiplier={1}
              >
                Boosts
              </Text>
            </View>

            <View style={styles.rewardStatDivider} />

            <View style={styles.rewardStat}>
              <Text style={styles.rewardStatValue}>
                {completedSkrPurchases}
              </Text>
              <Text
                style={styles.rewardStatLabel}
                numberOfLines={2}
                maxFontSizeMultiplier={1}
              >
                SKR{'\n'}buys
              </Text>
            </View>
          </View>

          <View style={styles.rewardRule}>
            <Text style={styles.rewardRuleTitle}>Reward rule</Text>
            <Text style={styles.rewardRuleText}>
              First completed SKR purchase: +100 TEFTE XP and +1 Listing Boost.
              Later purchases: +20 XP plus +1 XP per $1 of order value, with a
              maximum +30 spend bonus per order.
            </Text>
          </View>

          <View style={styles.rewardActivity}>
            <View style={styles.rewardActivityHeader}>
              <View>
                <Text style={styles.rewardActivityTitle}>
                  Reward activity
                </Text>
                <Text style={styles.rewardActivitySubtitle}>
                  SKR rewards
                </Text>
              </View>

              <Text style={styles.rewardActivityCount}>
                {serverRewards?.history?.length ?? 0}
              </Text>
            </View>

            {recentRewardHistory.length === 0 ? (
              <View style={styles.rewardActivityEmpty}>
                <Text style={styles.rewardActivityEmptyTitle}>
                  No rewards yet
                </Text>
                <Text style={styles.rewardActivityEmptyText}>
                  Completed SKR purchases will appear here.
                </Text>
              </View>
            ) : (
              recentRewardHistory.map((reward, index) => {
                const rewardOrder = orders.find(
                  (order) => order.id === reward.orderId,
                )

                const rewardDate = reward.awardedAt
                  ? new Date(reward.awardedAt).toLocaleDateString()
                  : ''

                return (
                  <View
                    key={reward.orderId}
                    style={[
                      styles.rewardActivityRow,
                      index !== recentRewardHistory.length - 1 &&
                        styles.rewardActivityRowBorder,
                    ]}
                  >
                    <View style={styles.rewardActivityIcon}>
                      <Text style={styles.rewardActivityIconText}>
                        +XP
                      </Text>
                    </View>

                    <View style={styles.rewardActivityInfo}>
                      <Text
                        style={styles.rewardActivityProduct}
                        numberOfLines={1}
                      >
                        {rewardOrder?.productTitle || 'SKR purchase'}
                      </Text>

                      <Text style={styles.rewardActivityMeta}>
                        {rewardDate || 'Completed purchase'}
                      </Text>
                    </View>

                    <View style={styles.rewardActivityAmount}>
                      <Text style={styles.rewardActivityXp}>
                        +{reward.xpAwarded} XP
                      </Text>

                      {reward.listingBoostsAwarded > 0 ? (
                        <Text style={styles.rewardActivityBoost}>
                          +{reward.listingBoostsAwarded} Boost
                        </Text>
                      ) : null}
                    </View>
                  </View>
                )
              })
            )}
          </View>
        </View>

        <View style={styles.stakeCard}>
          <View style={styles.stakeIcon}>
            <Text style={styles.stakeIconText}>SKR</Text>
          </View>

          <View style={styles.rewardInfo}>
            <Text style={styles.rewardTitle}>Stake / Lock SKR</Text>
            <Text style={styles.rewardText}>
              Long-term perks and status. This is separate from purchase
              rewards.
            </Text>
          </View>

          <Text style={styles.comingSoon}>Later</Text>
        </View>
            </View>
          ) : null}
        </View>

        <View style={styles.accordionSection}>
          <Pressable
            style={({ pressed }) => [
              styles.accordionHeader,
              pressed && styles.accordionPressed,
            ]}
            onPress={() => toggleSection('purchases')}
          >
            <View style={styles.accordionHeaderText}>
              <Text style={styles.accordionTitle}>My purchases</Text>
              <Text style={styles.accordionSummary}>
                Orders you placed on TEFTE
              </Text>
            </View>

            <View style={styles.accordionRight}>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {myPurchases.length}
                </Text>
              </View>

              <Text style={styles.accordionChevron}>
                {openSection === 'purchases' ? '⌃' : '⌄'}
              </Text>
            </View>
          </Pressable>

          {openSection === 'purchases' ? (
            <View style={styles.accordionBody}>
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
                            : order.status === 'delivered'
                              ? 'Delivered'
                              : order.status === 'disputed'
                                ? 'Disputed'
                                : order.status === 'received'
                                  ? 'Received'
                                  : 'Completed'}
                </Text>
              </View>
            </Pressable>
          ))
        )}
            </View>
          ) : null}
        </View>

        <View style={styles.accordionSection}>
          <Pressable
            style={({ pressed }) => [
              styles.accordionHeader,
              pressed && styles.accordionPressed,
            ]}
            onPress={() => toggleSection('listings')}
          >
            <View style={styles.accordionHeaderText}>
              <Text style={styles.accordionTitle}>My listings</Text>
              <Text style={styles.accordionSummary}>
                Manage products you published
              </Text>
            </View>

            <View style={styles.accordionRight}>
              {!loading && !error ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{products.length}</Text>
                </View>
              ) : null}

              <Text style={styles.accordionChevron}>
                {openSection === 'listings' ? '⌃' : '⌄'}
              </Text>
            </View>
          </Pressable>

          {openSection === 'listings' ? (
            <View style={styles.accordionBody}>
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
            <Text style={styles.emptyEmoji}>+</Text>
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
              const boostActive = isProductBoostActive(product)
              const boostTimeLabel = getBoostTimeLabel(product)

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

                      {boostActive ? (
                        <View style={styles.boostedBadge}>
                          <Text style={styles.boostedBadgeText}>
                            BOOSTED · {boostTimeLabel}
                          </Text>
                        </View>
                      ) : null}

                      <Text style={styles.productTitle} numberOfLines={2}>
                        {product.title}
                      </Text>

                      <Text style={styles.productMeta} numberOfLines={1}>
                        {[product.category, product.condition]
                          .filter(Boolean)
                          .join(' | ')}
                      </Text>

                      <View style={styles.productBottom}>
                        <Text style={styles.productPrice}>
                          {product.price} {product.currency || 'USDC'}
                        </Text>

                        <Text style={styles.arrow}>{'>'}</Text>
                      </View>
                    </View>
                  </Pressable>

                  <View style={styles.boostControlWrap}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.boostButton,
                        (busy ||
                          status === 'sold' ||
                          boostActive ||
                          listingBoosts < 1 ||
                          !walletAddress) &&
                          styles.boostButtonDisabled,
                        pressed &&
                          !busy &&
                          status !== 'sold' &&
                          !boostActive &&
                          listingBoosts > 0 &&
                          Boolean(walletAddress) &&
                          styles.controlPressed,
                      ]}
                      disabled={
                        busy ||
                        status === 'sold' ||
                        boostActive ||
                        listingBoosts < 1 ||
                        !walletAddress
                      }
                      onPress={() => askBoostListing(product)}
                    >
                      <Text
                        style={[
                          styles.boostButtonText,
                          (status === 'sold' ||
                            boostActive ||
                            listingBoosts < 1 ||
                            !walletAddress) &&
                            styles.boostButtonTextDisabled,
                        ]}
                      >
                        {busy
                          ? 'Working...'
                          : boostActive
                            ? `Boosted · ${boostTimeLabel}`
                            : status === 'sold'
                              ? 'Boost unavailable'
                              : listingBoosts < 1
                                ? 'No Boosts available'
                                : 'Use 1 Boost · 24h'}
                      </Text>
                    </Pressable>
                  </View>

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
            </View>
          ) : null}
        </View>

        <View style={styles.accordionSection}>
          <Pressable
            style={({ pressed }) => [
              styles.accordionHeader,
              pressed && styles.accordionPressed,
            ]}
            onPress={() => toggleSection('sales')}
          >
            <View style={styles.accordionHeaderText}>
              <Text style={styles.accordionTitle}>Sales</Text>
              <Text style={styles.accordionSummary}>
                Orders placed on your listings
              </Text>
            </View>

            <View style={styles.accordionRight}>
              {salesActionNeededCount > 0 ? (
                <View style={styles.actionNeededPill}>
                  <Text style={styles.actionNeededPillText}>
                    {salesActionNeededCount} action
                  </Text>
                </View>
              ) : null}

              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {mySales.length}
                </Text>
              </View>

              <Text style={styles.accordionChevron}>
                {openSection === 'sales' ? '⌃' : '⌄'}
              </Text>
            </View>
          </Pressable>

          {openSection === 'sales' ? (
            <View style={styles.accordionBody}>
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
                            : order.status === 'delivered'
                              ? 'Delivered'
                              : order.status === 'disputed'
                                ? 'Disputed'
                                : order.status === 'received'
                                  ? 'Received'
                                  : 'Completed'}
                </Text>
              </View>
            </Pressable>
          ))
        )}
            </View>
          ) : null}
        </View>

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
    color: '#5B331E',
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

  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
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

  bigAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 33,
  },

  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#5B331E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarEditBadgeText: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 18,
    fontWeight: '800',
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
    paddingHorizontal: 6,
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
    fontSize: 9,
    color: '#888888',
  },

  trustDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#ECECE8',
  },

  rewardsPanel: {
    backgroundColor: '#FFF3DD',
    borderRadius: 22,
    padding: 15,
    marginTop: 11,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1D7AE',
  },

  rewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  rewardMascot: {
    width: 62,
    height: 62,
    marginRight: 10,
    marginLeft: -4,
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

  rewardLiveBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },

  rewardLiveBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#367A51',
  },

  levelCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 17,
    backgroundColor: '#5B331E',
  },

  levelTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },

  levelEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#AFAFAF',
  },

  levelTitle: {
    marginTop: 2,
    fontSize: 21,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  levelXp: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  levelTrack: {
    height: 8,
    marginTop: 14,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#3A3A3A',
  },

  levelFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },

  levelBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
  },

  levelHint: {
    fontSize: 10,
    color: '#BDBDBD',
  },

  levelHintLeft: {
    flex: 1,
    marginRight: 10,
  },

  rewardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },

  rewardStat: {
    flex: 1,
    alignItems: 'center',
  },

  rewardStatValue: {
    fontSize: 19,
    fontWeight: '900',
    color: '#111111',
  },

  rewardStatLabel: {
    marginTop: 4,
    fontSize: 9,
    paddingHorizontal: 2,
    color: '#777777',
    textAlign: 'center',
  },

  rewardStatDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#ECECE8',
  },

  rewardRule: {
    marginTop: 12,
    padding: 12,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.58)',
  },

  rewardRuleTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#333333',
  },

  rewardRuleText: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: '#666666',
  },

  rewardActivity: {
    marginTop: 12,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },

  rewardActivityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 11,
  },

  rewardActivityTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111111',
  },

  rewardActivitySubtitle: {
    marginTop: 2,
    fontSize: 10,
    color: '#777777',
  },

  rewardActivityCount: {
    minWidth: 25,
    height: 25,
    paddingHorizontal: 7,
    borderRadius: 13,
    backgroundColor: '#111111',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 25,
  },

  rewardActivityEmpty: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 15,
  },

  rewardActivityEmptyTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#333333',
  },

  rewardActivityEmptyText: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 14,
    color: '#777777',
  },

  rewardActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    paddingVertical: 11,
  },

  rewardActivityRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEA',
  },

  rewardActivityIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#EEEDE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  rewardActivityIconText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#111111',
  },

  rewardActivityInfo: {
    flex: 1,
    minWidth: 0,
  },

  rewardActivityProduct: {
    fontSize: 11,
    fontWeight: '800',
    color: '#222222',
  },

  rewardActivityMeta: {
    marginTop: 3,
    fontSize: 9,
    color: '#888888',
  },

  rewardActivityAmount: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },

  rewardActivityXp: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111111',
  },

  rewardActivityBoost: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '700',
    color: '#777777',
  },

  stakeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 15,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#ECECE8',
  },

  stakeIcon: {
    width: 52,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#EEEDE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  stakeIconText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111111',
  },

  comingSoon: {
    marginLeft: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#777777',
  },

  accordionSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 10,
    overflow: 'hidden',
  },

  accordionHeader: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  accordionPressed: {
    opacity: 0.72,
  },

  accordionHeaderText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },

  accordionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
  },

  accordionSummary: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 15,
    color: '#7A7A7A',
  },

  accordionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },

  actionNeededPill: {
    minHeight: 25,
    marginRight: 6,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionNeededPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  accordionChevron: {
    width: 22,
    marginLeft: 8,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '800',
    color: '#555555',
    textAlign: 'center',
  },

  accordionBody: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },

  compactRewardBadge: {
    minHeight: 25,
    paddingHorizontal: 9,
    borderRadius: 13,
    backgroundColor: '#F4F7F2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  compactRewardBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#4F7D58',
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

  boostedBadge: {
    alignSelf: 'flex-start',
    marginBottom: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#111111',
  },

  boostedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  boostControlWrap: {
    paddingHorizontal: 10,
    paddingBottom: 7,
  },

  boostButton: {
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  boostButtonDisabled: {
    backgroundColor: '#E9E9E5',
  },

  boostButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  boostButtonTextDisabled: {
    color: '#888888',
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
