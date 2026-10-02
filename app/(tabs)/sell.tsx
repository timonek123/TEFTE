import { API_URL } from '../../lib/api'
import { useState } from 'react'
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'

const MAX_PHOTOS = 8

type Listing = {
  title: string
  category: string
  condition: string
  description: string
  suggestedPrice: number
}

export default function SellScreen() {
  const [imageUris, setImageUris] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [listing, setListing] = useState<Listing | null>(null)

  const mainImageUri = imageUris[0] ?? null
  const remainingPhotos = MAX_PHOTOS - imageUris.length

  async function takePhoto() {
    if (imageUris.length >= MAX_PHOTOS) {
      Alert.alert(
        'Photo limit reached',
        `You can add up to ${MAX_PHOTOS} photos.`
      )
      return
    }

    const permission =
      await ImagePicker.requestCameraPermissionsAsync()

    if (!permission.granted) {
      Alert.alert(
        'Camera permission needed',
        'TEFTE needs access to your camera to photograph the item.'
      )
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]?.uri) {
      const uri = result.assets[0].uri

      setImageUris((current) => [...current, uri])
    }
  }

  async function chooseFromGallery() {
    if (remainingPhotos <= 0) {
      Alert.alert(
        'Photo limit reached',
        `You can add up to ${MAX_PHOTOS} photos.`
      )
      return
    }

    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      Alert.alert(
        'Photo permission needed',
        'TEFTE needs access to your photos so you can select item photos.'
      )
      return
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: remainingPhotos,
        quality: 0.8,
      })

    if (!result.canceled) {
      const newUris = result.assets
        .map((asset) => asset.uri)
        .filter(Boolean)

      if (newUris.length > 0) {
        setImageUris((current) => [
          ...current,
          ...newUris,
        ].slice(0, MAX_PHOTOS))
      }
    }
  }

  function addPhoto() {
    if (imageUris.length >= MAX_PHOTOS) {
      Alert.alert(
        'Photo limit reached',
        `You already have ${MAX_PHOTOS} photos. Remove one to add another.`
      )
      return
    }

    Alert.alert(
      'Add photos',
      `You can add ${remainingPhotos} more.`,
      [
        {
          text: 'Take photo',
          onPress: takePhoto,
        },
        {
          text: 'Choose from gallery',
          onPress: chooseFromGallery,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    )
  }

  function removePhoto(index: number) {
    const removingMainPhoto = index === 0

    setImageUris((current) =>
      current.filter((_, photoIndex) => photoIndex !== index)
    )

    if (removingMainPhoto) {
      setListing(null)
    }
  }

  async function analyzePhoto() {
    if (!mainImageUri || loading) {
      return
    }

    try {
      setLoading(true)

      const formData = new FormData()

      formData.append(
        'image',
        {
          uri: mainImageUri,
          name: 'tefte-product.jpg',
          type: 'image/jpeg',
        } as any
      )

      const response = await fetch(
        `${API_URL}/api/analyze-product`,
        {
          method: 'POST',
          body: formData,
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'TEFTE AI could not analyze the photo.'
        )
      }

      if (!data.listing) {
        throw new Error(
          'TEFTE AI returned no listing.'
        )
      }

      setListing(data.listing)
    } catch (error) {
      console.error(
        'TEFTE vision error:',
        error
      )

      Alert.alert(
        'Analysis failed',
        error instanceof Error
          ? error.message
          : 'TEFTE AI could not analyze the photo.'
      )
    } finally {
      setLoading(false)
    }
  }

  function updateListing(
    field: keyof Listing,
    value: string
  ) {
    if (!listing) {
      return
    }

    if (field === 'suggestedPrice') {
      setListing({
        ...listing,
        suggestedPrice: Number(value) || 0,
      })
      return
    }

    setListing({
      ...listing,
      [field]: value,
    })
  }

  async function publishListing() {
    if (
      !listing ||
      imageUris.length === 0 ||
      publishing
    ) {
      if (imageUris.length === 0) {
        Alert.alert(
          'Photo required',
          'Please add at least one product photo before publishing.'
        )
      }

      return
    }

    try {
      setPublishing(true)

      const formData = new FormData()

      imageUris.forEach((uri, index) => {
        formData.append(
          'images',
          {
            uri,
            name: `tefte-listing-${index + 1}.jpg`,
            type: 'image/jpeg',
          } as any
        )
      })

      formData.append(
        'title',
        listing.title
      )

      formData.append(
        'category',
        listing.category
      )

      formData.append(
        'condition',
        listing.condition
      )

      formData.append(
        'description',
        listing.description
      )

      formData.append(
        'price',
        String(listing.suggestedPrice)
      )

      const response = await fetch(
        `${API_URL}/api/products`,
        {
          method: 'POST',
          body: formData,
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Failed to publish listing.'
        )
      }

      Alert.alert(
        'Published!',
        `${data.product.title} is now live on TEFTE.`
      )

      setListing(null)
      setImageUris([])
    } catch (error) {
      console.error(
        'Publish listing error:',
        error
      )

      Alert.alert(
        'Publish failed',
        error instanceof Error
          ? error.message
          : 'Could not publish the listing.'
      )
    } finally {
      setPublishing(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          Sell
        </Text>

        <Text style={styles.subtitle}>
          Add up to 8 photos. TEFTE AI will use the
          main photo to create your listing.
        </Text>

        {mainImageUri ? (
          <View style={styles.photoSection}>
            <View style={styles.mainPhotoWrapper}>
              <Image
                source={{ uri: mainImageUri }}
                style={styles.mainPhoto}
                resizeMode="cover"
              />

              <View style={styles.mainBadge}>
                <Text style={styles.mainBadgeText}>
                  MAIN
                </Text>
              </View>
            </View>

            <View style={styles.photoHeader}>
              <View>
                <Text style={styles.photoCountTitle}>
                  Product photos
                </Text>

                <Text style={styles.photoCountText}>
                  {imageUris.length} / {MAX_PHOTOS}
                </Text>
              </View>

              {imageUris.length < MAX_PHOTOS && (
                <Pressable
                  style={styles.addMoreButton}
                  onPress={addPhoto}
                  disabled={loading || publishing}
                >
                  <Text style={styles.addMoreButtonText}>
                    + Add photos
                  </Text>
                </Pressable>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailRow}
            >
              {imageUris.map((uri, index) => (
                <View
                  key={`${uri}-${index}`}
                  style={styles.thumbnailWrapper}
                >
                  <Image
                    source={{ uri }}
                    style={[
                      styles.thumbnail,
                      index === 0 &&
                        styles.mainThumbnail,
                    ]}
                    resizeMode="cover"
                  />

                  {index === 0 && (
                    <View
                      style={styles.thumbnailMainBadge}
                    >
                      <Text
                        style={
                          styles.thumbnailMainBadgeText
                        }
                      >
                        Main
                      </Text>
                    </View>
                  )}

                  <Pressable
                    style={styles.removeButton}
                    onPress={() =>
                      removePhoto(index)
                    }
                    disabled={
                      loading || publishing
                    }
                  >
                    <Text
                      style={styles.removeButtonText}
                    >
                      Г—
                    </Text>
                  </Pressable>
                </View>
              ))}

              {imageUris.length < MAX_PHOTOS && (
                <Pressable
                  style={styles.addThumbnail}
                  onPress={addPhoto}
                  disabled={loading || publishing}
                >
                  <Text
                    style={styles.addThumbnailPlus}
                  >
                    +
                  </Text>

                  <Text
                    style={styles.addThumbnailText}
                  >
                    Add
                  </Text>
                </Pressable>
              )}
            </ScrollView>

            <Text style={styles.mainPhotoHint}>
              The first photo is the main photo and is
              used by TEFTE AI.
            </Text>
          </View>
        ) : (
          <Pressable
            style={styles.photoBox}
            onPress={addPhoto}
          >
            <View style={styles.cameraCircle}>
              <Text style={styles.cameraIcon}>
                +
              </Text>
            </View>

            <Text style={styles.photoTitle}>
              Add item photos
            </Text>

            <Text style={styles.photoText}>
              Take photos or select up to 8 from your
              gallery.
            </Text>
          </Pressable>
        )}

        {!listing && (
          <>
            <View style={styles.aiCard}>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>
                  TEFTE AI
                </Text>
              </View>

              <Text style={styles.aiTitle}>
                Let Tefte do the work
              </Text>

              <Text style={styles.aiText}>
                AI will identify your item from the main
                photo and suggest a title, category,
                condition, description and price.
              </Text>
            </View>

            <Pressable
              style={[
                styles.analyzeButton,
                (!mainImageUri || loading) &&
                  styles.analyzeButtonDisabled,
              ]}
              disabled={
                !mainImageUri ||
                loading ||
                publishing
              }
              onPress={analyzePhoto}
            >
              <Text
                style={[
                  styles.analyzeButtonText,
                  (!mainImageUri || loading) &&
                    styles.analyzeButtonTextDisabled,
                ]}
              >
                {loading
                  ? 'Tefte is analyzing...'
                  : 'Analyze with TEFTE AI'}
              </Text>
            </Pressable>
          </>
        )}

        {listing && (
          <View style={styles.listingSection}>
            <View style={styles.generatedHeader}>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>
                  AI DRAFT
                </Text>
              </View>

              <Text style={styles.generatedTitle}>
                Your listing is ready
              </Text>

              <Text style={styles.generatedText}>
                Review and edit everything before
                publishing.
              </Text>
            </View>

            <Text style={styles.label}>
              Title
            </Text>

            <TextInput
              style={styles.input}
              value={listing.title}
              onChangeText={(value) =>
                updateListing(
                  'title',
                  value
                )
              }
            />

            <Text style={styles.label}>
              Category
            </Text>

            <TextInput
              style={styles.input}
              value={listing.category}
              onChangeText={(value) =>
                updateListing(
                  'category',
                  value
                )
              }
            />

            <Text style={styles.label}>
              Condition
            </Text>

            <TextInput
              style={styles.input}
              value={listing.condition}
              onChangeText={(value) =>
                updateListing(
                  'condition',
                  value
                )
              }
            />

            <Text style={styles.label}>
              Description
            </Text>

            <TextInput
              style={[
                styles.input,
                styles.descriptionInput,
              ]}
              value={listing.description}
              onChangeText={(value) =>
                updateListing(
                  'description',
                  value
                )
              }
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.label}>
              Suggested price
            </Text>

            <View style={styles.priceRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.priceInput,
                ]}
                value={String(
                  listing.suggestedPrice
                )}
                onChangeText={(value) =>
                  updateListing(
                    'suggestedPrice',
                    value
                  )
                }
                keyboardType="decimal-pad"
              />

              <View style={styles.currencyBox}>
                <Text style={styles.currencyText}>
                  USDC
                </Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.publishButton,
                publishing &&
                  styles.publishButtonDisabled,
              ]}
              onPress={publishListing}
              disabled={publishing || loading}
            >
              <Text style={styles.publishButtonText}>
                {publishing
                  ? 'Publishing...'
                  : `Publish with ${imageUris.length} ${
                      imageUris.length === 1
                        ? 'photo'
                        : 'photos'
                    }`}
              </Text>
            </Pressable>

            <Pressable
              style={styles.analyzeAgainButton}
              onPress={analyzePhoto}
              disabled={loading || publishing}
            >
              <Text style={styles.analyzeAgainText}>
                {loading
                  ? 'Tefte is analyzing...'
                  : 'Analyze main photo again'}
              </Text>
            </Pressable>
          </View>
        )}
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
    padding: 24,
    paddingBottom: 120,
  },

  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111111',
  },

  subtitle: {
    marginTop: 6,
    fontSize: 16,
    lineHeight: 23,
    color: '#777777',
  },

  photoBox: {
    marginTop: 28,
    minHeight: 260,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBCBC6',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },

  cameraCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cameraIcon: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '300',
    marginTop: -2,
  },

  photoTitle: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
  },

  photoText: {
    marginTop: 8,
    maxWidth: 270,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: '#777777',
  },

  photoSection: {
    marginTop: 28,
  },

  mainPhotoWrapper: {
    position: 'relative',
  },

  mainPhoto: {
    width: '100%',
    height: 320,
    borderRadius: 24,
    backgroundColor: '#EAEAE6',
  },

  mainBadge: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#111111',
  },

  mainBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  photoHeader: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  photoCountTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
  },

  photoCountText: {
    marginTop: 2,
    fontSize: 13,
    color: '#777777',
  },

  addMoreButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: '#111111',
  },

  addMoreButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  thumbnailRow: {
    marginTop: 14,
    paddingRight: 8,
    gap: 10,
  },

  thumbnailWrapper: {
    position: 'relative',
    width: 92,
    height: 92,
  },

  thumbnail: {
    width: 92,
    height: 92,
    borderRadius: 16,
    backgroundColor: '#EAEAE6',
    borderWidth: 1,
    borderColor: '#E3E3DF',
  },

  mainThumbnail: {
    borderWidth: 2,
    borderColor: '#111111',
  },

  thumbnailMainBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#111111',
  },

  thumbnailMainBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },

  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  removeButtonText: {
    marginTop: -2,
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '600',
  },

  addThumbnail: {
    width: 92,
    height: 92,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBCBC6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  addThumbnailPlus: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
    color: '#111111',
  },

  addThumbnailText: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: '#777777',
  },

  mainPhotoHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: '#888888',
  },

  aiCard: {
    marginTop: 20,
    padding: 20,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E4',
  },

  aiBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#111111',
  },

  aiBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  aiTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
  },

  aiText: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 21,
    color: '#777777',
  },

  analyzeButton: {
    marginTop: 20,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  analyzeButtonDisabled: {
    backgroundColor: '#D5D5D1',
  },

  analyzeButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  analyzeButtonTextDisabled: {
    color: '#999995',
  },

  listingSection: {
    marginTop: 22,
  },

  generatedHeader: {
    padding: 20,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E4',
    marginBottom: 22,
  },

  generatedTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
  },

  generatedText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#777777',
  },

  label: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '800',
    color: '#555555',
  },

  input: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3DF',
    fontSize: 16,
    color: '#111111',
  },

  descriptionInput: {
    minHeight: 120,
  },

  priceRow: {
    flexDirection: 'row',
    gap: 10,
  },

  priceInput: {
    flex: 1,
  },

  currencyBox: {
    minWidth: 78,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#EAEAE6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  currencyText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },

  publishButton: {
    marginTop: 26,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  publishButtonDisabled: {
    opacity: 0.55,
  },

  publishButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  analyzeAgainButton: {
    marginTop: 12,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },

  analyzeAgainText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555555',
  },
})



