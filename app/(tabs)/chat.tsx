import { useCallback, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

type Conversation = {
  id: string
  seller: string
  productTitle: string
  price: number
  currency: string
  lastMessage: string
  time: string
  imageUrl?: string
}

type ServerMessage = {
  id: string
  chatId: string
  text: string
  sender: string
  time: string
}

const API_URL = 'http://192.168.68.55:3000'

const defaultConversations: Conversation[] = [
  {
    id: 'demo-samsung',
    seller: 'crypton.skr',
    productTitle: 'Samsung Galaxy Fit3 Fitness Tracker',
    price: 80,
    currency: 'USDC',
    lastMessage: 'Hi! Is this still available?',
    time: '11:32',
    imageUrl:
      '/uploads/listing-1790605722826-233703301.jpg',
  },
  {
    id: 'demo-snow-globe',
    seller: 'crypton.skr',
    productTitle: 'Merry Christmas Snow Globe with Red Base',
    price: 20,
    currency: 'USDC',
    lastMessage: 'Can you ship it tomorrow?',
    time: 'Yesterday',
    imageUrl:
      '/uploads/listing-1790667942610-121831658.jpg',
  },
]

function getImageUrl(imageUrl?: string) {
  if (!imageUrl) {
    return null
  }

  if (
    imageUrl.startsWith('http://') ||
    imageUrl.startsWith('https://')
  ) {
    return imageUrl
  }

  return `${API_URL}${imageUrl}`
}

function formatMessageTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ChatScreen() {
  const router = useRouter()

  const [conversations, setConversations] =
    useState<Conversation[]>(defaultConversations)

  const loadConversations = useCallback(async () => {
    const updated = await Promise.all(
      defaultConversations.map(async (conversation) => {
        try {
          const response = await fetch(
            `${API_URL}/api/chats/${conversation.id}/messages`
          )

          const data = await response.json()

          if (!response.ok) {
            throw new Error(
              data.error || 'Could not load chat preview'
            )
          }

          const messages: ServerMessage[] =
            Array.isArray(data?.messages)
              ? data.messages
              : []

          if (messages.length === 0) {
            return conversation
          }

          const lastMessage =
            messages[messages.length - 1]

          return {
            ...conversation,
            lastMessage: lastMessage.text,
            time: formatMessageTime(lastMessage.time),
          }
        } catch (error) {
          console.error(
            'TEFTE conversation preview error:',
            error
          )

          return conversation
        }
      })
    )

    setConversations(updated)
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadConversations()
    }, [loadConversations])
  )

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>TEFTE</Text>

        <Text style={styles.title}>
          Messages
        </Text>

        <Text style={styles.subtitle}>
          Talk with buyers and sellers.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {conversations.map((conversation) => {
          const imageUri =
            getImageUrl(conversation.imageUrl)

          return (
            <Pressable
              key={conversation.id}
              onPress={() =>
                router.push({
                  pathname: '/chat/[id]',
                  params: {
                    id: conversation.id,
                  },
                })
              }
              style={({ pressed }) => [
                styles.conversation,
                pressed &&
                  styles.conversationPressed,
              ]}
            >
              <View style={styles.productImage}>
                {imageUri ? (
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                ) : (
                  <Text
                    style={styles.imagePlaceholder}
                  >
                    TEFTE
                  </Text>
                )}
              </View>

              <View
                style={styles.conversationContent}
              >
                <View style={styles.topRow}>
                  <Text
                    style={styles.productTitle}
                    numberOfLines={1}
                  >
                    {conversation.productTitle}
                  </Text>

                  <Text style={styles.time}>
                    {conversation.time}
                  </Text>
                </View>

                <View style={styles.sellerRow}>
                  <Text style={styles.seller}>
                    {conversation.seller}
                  </Text>

                  <Text style={styles.price}>
                    {conversation.price}{' '}
                    {conversation.currency}
                  </Text>
                </View>

                <View style={styles.messageRow}>
                  <Text
                    style={styles.lastMessage}
                    numberOfLines={1}
                  >
                    {conversation.lastMessage}
                  </Text>
                </View>
              </View>
            </Pressable>
          )
        })}

        <View style={styles.safetyCard}>
          <View style={styles.safetyIcon}>
            <Text style={styles.safetyIconText}>
              T
            </Text>
          </View>

          <View style={styles.safetyContent}>
            <Text style={styles.safetyTitle}>
              Keep deals inside TEFTE
            </Text>

            <Text style={styles.safetyText}>
              Chat and pay through TEFTE to keep your
              purchase protected.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
  },

  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#777777',
  },

  title: {
    marginTop: 4,
    fontSize: 32,
    fontWeight: '900',
    color: '#111111',
  },

  subtitle: {
    marginTop: 5,
    fontSize: 15,
    color: '#777777',
  },

  list: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },

  conversation: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAE6',
  },

  conversationPressed: {
    opacity: 0.7,
  },

  productImage: {
    width: 76,
    height: 76,
    overflow: 'hidden',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEEEEA',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  imagePlaceholder: {
    fontSize: 12,
    fontWeight: '900',
    color: '#777777',
  },

  conversationContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  productTitle: {
    flex: 1,
    marginRight: 8,
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
  },

  time: {
    minWidth: 38,
    textAlign: 'right',
    flexShrink: 0,
    fontSize: 11,
    color: '#999999',
  },

  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  seller: {
    flex: 1,
    fontSize: 12,
    color: '#777777',
  },

  price: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111111',
  },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  lastMessage: {
    flex: 1,
    marginRight: 8,
    fontSize: 13,
    color: '#777777',
  },

  safetyCard: {
    flexDirection: 'row',
    marginTop: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#ECECE7',
  },

  safetyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },

  safetyIconText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  safetyContent: {
    flex: 1,
    marginLeft: 12,
  },

  safetyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },

  safetyText: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: '#666666',
  },
})
