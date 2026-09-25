import React, { useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useMobileWallet } from '@wallet-ui/react-native-kit'

export default function HomeScreen() {
  const { account, connect } = useMobileWallet()
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')

  function handleSearch() {
    const cleanQuery = query.trim()

    if (!cleanQuery) {
      return
    }

    setSubmittedQuery(cleanQuery)
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>Vendra</Text>

          {account ? (
            <View style={styles.connectedWallet}>
              <View style={styles.statusDot} />
              <Text style={styles.walletText}>{account.label}</Text>
            </View>
          ) : (
            <Pressable style={styles.walletButton} onPress={connect}>
              <Text style={styles.walletButtonText}>Connect wallet</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>
            What are you looking for?
          </Text>

          <Text style={styles.subtitle}>
            Tell Vendra what you want. AI will help you find it.
          </Text>

          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Find me a lightweight tent under $150..."
            placeholderTextColor="#999999"
            multiline
            returnKeyType="search"
          />

          <Pressable
            style={[
              styles.searchButton,
              !query.trim() && styles.searchButtonDisabled,
            ]}
            onPress={handleSearch}
            disabled={!query.trim()}
          >
            <Text style={styles.searchButtonText}>Ask Vendra</Text>
          </Pressable>

          {submittedQuery ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Your request</Text>
              <Text style={styles.resultText}>{submittedQuery}</Text>
            </View>
          ) : null}

          <Text style={styles.caption}>
            AI-powered marketplace on Solana
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111111',
  },

  connectedWallet: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginRight: 7,
  },

  walletText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },

  walletButton: {
    backgroundColor: '#111111',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 20,
  },

  walletButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  hero: {
    marginTop: 70,
  },

  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#111111',
    lineHeight: 41,
  },

  subtitle: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 26,
  },

  searchInput: {
    minHeight: 86,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111111',
    textAlignVertical: 'top',
  },

  searchButton: {
    backgroundColor: '#111111',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },

  searchButtonDisabled: {
    opacity: 0.35,
  },

  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  resultCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E3E0',
    borderRadius: 18,
    padding: 18,
    marginTop: 20,
  },

  resultLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888888',
    marginBottom: 7,
    textTransform: 'uppercase',
  },

  resultText: {
    fontSize: 16,
    color: '#111111',
    lineHeight: 23,
  },

  caption: {
    marginTop: 18,
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
  },
})