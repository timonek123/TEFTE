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

const API_URL = 'http://192.168.68.52:3000'

type Listing = {
  title: string
  category: string
  condition: string
  description: string
  suggestedPrice: number
}

export default function SellScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [listing, setListing] = useState<Listing | null>(null)

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync()

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

    if (!result.canceled) {
      setImageUri(result.assets[0].uri)
      setListing(null)
    }
  }

  async function chooseFromGallery() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      Alert.alert(
        'Photo permission needed',
        'TEFTE needs access to your photos so you can select an item.'
      )
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    })

    if (!result.canceled) {
      setImageUri(result.assets[0].uri)
      setListing(null)
    }
  }

  function addPhoto() {
    Alert.alert(
      'Add item photo',
      'Choose how you want to add a photo.',
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

  async function analyzePhoto() {
    if (!imageUri || loading) {
      return
    }

    try {
      setLoading(true)

      const formData = new FormData()

      formData.append(
        'image',
        {
          uri: imageUri,
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
          data?.error || 'TEFTE AI could not analyze the photo.'
        )
      }

      if (!data.listing) {
        throw new Error('TEFTE AI returned no listing.')
      }

      setListing(data.listing)
    } catch (error) {
      console.error('TEFTE vision error:', error)

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

  function publishListing() {
    if (!listing) {
      return
    }

    Alert.alert(
      'Listing ready',
      'Next we will connect publishing to the TEFTE marketplace.'
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Sell</Text>

        <Text style={styles.subtitle}>
          Take a photo. TEFTE AI will create your listing.
        </Text>

        {imageUri ? (
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: imageUri }}
              style={styles.photo}
              resizeMode="cover"
            />

            <Pressable
              style={styles.changeButton}
              onPress={addPhoto}
              disabled={loading}
            >
              <Text style={styles.changeButtonText}>
                Change photo
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.photoBox}
            onPress={addPhoto}
          >
            <View style={styles.cameraCircle}>
              <Text style={styles.cameraIcon}>＋</Text>
            </View>

            <Text style={styles.photoTitle}>
              Add item photo
            </Text>

            <Text style={styles.photoText}>
              Take a photo or choose one from your gallery.
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
                AI will identify your item and suggest a title,
                category, condition, description and price.
              </Text>
            </View>

            <Pressable
              style={[
                styles.analyzeButton,
                (!imageUri || loading) &&
                  styles.analyzeButtonDisabled,
              ]}
              disabled={!imageUri || loading}
              onPress={analyzePhoto}
            >
              <Text
                style={[
                  styles.analyzeButtonText,
                  (!imageUri || loading) &&
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
                Review and edit everything before publishing.
              </Text>
            </View>

            <Text style={styles.label}>Title</Text>

            <TextInput
              style={styles.input}
              value={listing.title}
              onChangeText={(value) =>
                updateListing('title', value)
              }
            />

            <Text style={styles.label}>Category</Text>

            <TextInput
              style={styles.input}
              value={listing.category}
              onChangeText={(value) =>
                updateListing('category', value)
              }
            />

            <Text style={styles.label}>Condition</Text>

            <TextInput
              style={styles.input}
              value={listing.condition}
              onChangeText={(value) =>
                updateListing('condition', value)
              }
            />

            <Text style={styles.label}>Description</Text>

            <TextInput
              style={[
                styles.input,
                styles.descriptionInput,
              ]}
              value={listing.description}
              onChangeText={(value) =>
                updateListing('description', value)
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
              style={styles.publishButton}
              onPress={publishListing}
            >
              <Text style={styles.publishButtonText}>
                Publish listing
              </Text>
            </Pressable>

            <Pressable
              style={styles.analyzeAgainButton}
              onPress={analyzePhoto}
            >
              <Text style={styles.analyzeAgainText}>
                Analyze again
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
    maxWidth: 260,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: '#777777',
  },

  photoContainer: {
    marginTop: 28,
  },

  photo: {
    width: '100%',
    height: 320,
    borderRadius: 24,
    backgroundColor: '#EAEAE6',
  },

  changeButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#EAEAE6',
  },

  changeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
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
  },

  publishButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
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