import { API_URL } from '../../lib/api'
import { useEffect, useRef, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

type Message = {
  id: string
  text: string
  mine: boolean
  time: string
}

const chatData = {
  'demo-samsung': {
    seller: 'crypton.skr',
    title: 'Samsung Galaxy Fit3 Fitness Tracker',
    price: 80,
    currency: 'USDC',
    imageUrl: '/uploads/listing-1790605722826-233703301.jpg',
    messages: [
      {
        id: '1',
        text: 'Hi! Is this still available?',
        mine: true,
        time: '11:30',
      },
      {
        id: '2',
        text: 'Yes, it is still available.',
        mine: false,
        time: '11:31',
      },
      {
        id: '3',
        text: 'Great! Is it brand new?',
        mine: true,
        time: '11:32',
      },
    ],
  },
  'demo-snow-globe': {
    seller: 'crypton.skr',
    title: 'Merry Christmas Snow Globe with Red Base',
    price: 20,
    currency: 'USDC',
    imageUrl: '/uploads/listing-1790667942610-121831658.jpg',
    messages: [
      {
        id: '1',
        text: 'Hello! Is the snow globe still available?',
        mine: true,
        time: '18:42',
      },
      {
        id: '2',
        text: 'Yes! It is in good condition.',
        mine: false,
        time: '18:44',
      },
      {
        id: '3',
        text: 'Can you ship it tomorrow?',
        mine: true,
        time: '18:45',
      },
    ],
  },
} as const

export default function ConversationScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const chat =
    chatData[id as keyof typeof chatData] ??
    chatData['demo-samsung']

  const [messages, setMessages] = useState<Message[]>(
    chat.messages.map((message) => ({ ...message }))
  )
  const [draft, setDraft] = useState('')
  const messagesRef = useRef<ScrollView>(null)
  const [editingMessageId, setEditingMessageId] =
    useState<string | null>(null)
  useEffect(() => {
    async function loadSavedMessages() {
      try {
        const response = await fetch(
          `${API_URL}/api/chats/${id}/messages`
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(
            data.error || 'Could not load messages'
          )
        }

        if (
          Array.isArray(data?.messages) &&
          data.messages.length > 0
        ) {
          setMessages(
            data.messages.map((message: any) => ({
              id: message.id,
              text: message.text,
              mine: message.sender === 'me',
              time: new Date(
                message.time
              ).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
            }))
          )
        }
      } catch (error) {
        console.error(
          'TEFTE chat load error:',
          error
        )
      }
    }

    if (id) {
      loadSavedMessages()
    }
  }, [id])

  async function sendMessage() {
    const text = draft.trim()

    if (!text) {
      return
    }

    try {
      if (editingMessageId) {
        const response = await fetch(
          `${API_URL}/api/chats/${id}/messages/${editingMessageId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text,
            }),
          }
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(
            data.error || 'Could not edit message'
          )
        }

        const editedMessage = data.data

        setMessages((current) =>
          current.map((message) =>
            message.id === editingMessageId
              ? {
                  ...message,
                  text: editedMessage.text,
                  edited: true,
                }
              : message
          )
        )

        setEditingMessageId(null)
        setDraft('')
        return
      }

      const response = await fetch(
        `${API_URL}/api/chats/${id}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            sender: 'me',
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || 'Could not send message'
        )
      }

      const savedMessage = data.data

      setMessages((current) => [
        ...current,
        {
          id: savedMessage.id,
          text: savedMessage.text,
          mine: true,
          time: new Date(
            savedMessage.time
          ).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ])

      setDraft('')
    } catch (error) {
      console.error(
        editingMessageId
          ? 'TEFTE chat edit error:'
          : 'TEFTE chat send error:',
        error
      )

      Alert.alert(
        editingMessageId
          ? 'Could not edit message'
          : 'Could not send message',
        'Please try again.'
      )
    }
  }

  function startEditingMessage(message: Message) {
    setEditingMessageId(message.id)
    setDraft(message.text)
  }

  async function deleteMessage(message: Message) {
    try {
      const response = await fetch(
        `${API_URL}/api/chats/${id}/messages/${message.id}`,
        {
          method: 'DELETE',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || 'Could not delete message'
        )
      }

      setMessages((current) =>
        current.filter(
          (currentMessage) =>
            currentMessage.id !== message.id
        )
      )

      if (editingMessageId === message.id) {
        setEditingMessageId(null)
        setDraft('')
      }
    } catch (error) {
      console.error(
        'TEFTE chat delete error:',
        error
      )

      Alert.alert(
        'Could not delete message',
        'Please try again.'
      )
    }
  }

  function showMessageActions(message: Message) {
    if (!message.mine) {
      return
    }

    Alert.alert(
      'Message',
      'What would you like to do?',
      [
        {
          text: 'Edit',
          onPress: () =>
            startEditingMessage(message),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete message?',
              'This message will be permanently deleted.',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () =>
                    deleteMessage(message),
                },
              ]
            )
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    )
  }

  const imageUri = `${API_URL}${chat.imageUrl}`

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>{'<'}</Text>
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.seller}>{chat.seller}</Text>
            <Text style={styles.status}>Active on TEFTE</Text>
          </View>

          <View style={styles.trustBadge}>
            <Text style={styles.trustText}>T</Text>
          </View>
        </View>

        <View style={styles.productCard}>
          <Image
            source={{ uri: imageUri }}
            style={styles.productImage}
            resizeMode="cover"
          />

          <View style={styles.productInfo}>
            <Text style={styles.productTitle} numberOfLines={1}>
              {chat.title}
            </Text>

            <Text style={styles.price}>
              {chat.price} {chat.currency}
            </Text>

            <Text style={styles.protected}>
              Payment protected by TEFTE
            </Text>
          </View>
        </View>

        <ScrollView
          ref={messagesRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            messagesRef.current?.scrollToEnd({ animated: true })
          }
        >
          <View style={styles.day}>
            <Text style={styles.dayText}>Today</Text>
          </View>

          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageRow,
                message.mine
                  ? styles.messageRowMine
                  : styles.messageRowOther,
              ]}
            >
              <Pressable
                onLongPress={() =>
                  showMessageActions(message)
                }
                delayLongPress={350}
                style={[
                  styles.bubble,
                  message.mine
                    ? styles.bubbleMine
                    : styles.bubbleOther,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    message.mine && styles.messageTextMine,
                  ]}
                >
                  {message.text}
                </Text>

                <Text
                  style={[
                    styles.messageTime,
                    message.mine && styles.messageTimeMine,
                  ]}
                >
                  {message.time}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>

        {editingMessageId ? (
          <View style={styles.editingBar}>
            <View style={styles.editingTextBlock}>
              <Text style={styles.editingTitle}>
                Editing message
              </Text>

              <Text
                style={styles.editingPreview}
                numberOfLines={1}
              >
                {draft}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                setEditingMessageId(null)
                setDraft('')
              }}
              style={styles.cancelEditButton}
            >
              <Text style={styles.cancelEditText}>
                Cancel
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={
              editingMessageId
                ? 'Edit message...'
                : 'Write a message...'
            }
            placeholderTextColor="#999999"
            style={styles.input}
            multiline
          />

          <Pressable
            onPress={sendMessage}
            disabled={!draft.trim()}
            style={[
              styles.sendButton,
              !draft.trim() &&
                styles.sendButtonDisabled,
            ]}
          >
            <Text style={styles.sendText}>
              {editingMessageId ? 'Save' : 'Send'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E7E2',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0EC',
  },
  backText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111111',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  seller: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
  },
  status: {
    marginTop: 2,
    fontSize: 12,
    color: '#777777',
  },
  trustBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  trustText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  productCard: {
    flexDirection: 'row',
    margin: 14,
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E7E7E2',
    backgroundColor: '#FFFFFF',
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 13,
    backgroundColor: '#EEEEEA',
  },
  productInfo: {
    flex: 1,
    marginLeft: 11,
    justifyContent: 'center',
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  price: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '900',
    color: '#111111',
  },
  protected: {
    marginTop: 4,
    fontSize: 11,
    color: '#6F6F68',
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  day: {
    alignItems: 'center',
    marginVertical: 10,
  },
  dayText: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    overflow: 'hidden',
    fontSize: 11,
    color: '#777777',
    backgroundColor: '#EAEAE5',
  },
  messageRow: {
    width: '100%',
    marginVertical: 4,
  },
  messageRowMine: {
    alignItems: 'flex-end',
  },
  messageRowOther: {
    alignItems: 'flex-start',
  },
  bubble: {
    width: '82%',
    maxWidth: 320,
    minWidth: 60,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 7,
    borderRadius: 18,
  },
  bubbleMine: {
    borderBottomRightRadius: 5,
    backgroundColor: '#111111',
  },
  bubbleOther: {
    borderBottomLeftRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E7E2',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    width: '100%',
    color: '#222222',
  },
  messageTextMine: {
    color: '#FFFFFF',
  },
  messageTime: {
    marginTop: 4,
    alignSelf: 'flex-end',
    fontSize: 9,
    color: '#999999',
  },
  messageTimeMine: {
    color: '#BBBBBB',
  },
  editingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#E7E7E2',
    backgroundColor: '#F0F0EC',
  },

  editingTextBlock: {
    flex: 1,
    marginRight: 12,
  },

  editingTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111111',
  },

  editingPreview: {
    marginTop: 2,
    fontSize: 11,
    color: '#777777',
  },

  cancelEditButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  cancelEditText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#666666',
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#E7E7E2',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 110,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 23,
    fontSize: 15,
    color: '#111111',
    backgroundColor: '#F0F0EC',
  },
  sendButton: {
    height: 46,
    marginLeft: 8,
    paddingHorizontal: 17,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  sendButtonDisabled: {
    opacity: 0.3,
  },
  sendText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
})















