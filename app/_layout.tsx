import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import 'react-native-reanimated'
import { AppProviders } from '@/components/app-providers'

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack
        initialRouteName="(tabs)"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product/[id]" />
      </Stack>

      <StatusBar style="dark" />
    </AppProviders>
  )
}