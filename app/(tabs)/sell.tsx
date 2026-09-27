import { SafeAreaView } from 'react-native-safe-area-context'
import { StyleSheet, Text, View } from 'react-native'

export default function SellScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Sell</Text>
        <Text style={styles.text}>
          Take a photo and let TEFTE create your listing.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111111',
  },
  text: {
    marginTop: 8,
    fontSize: 16,
    color: '#777777',
  },
})