import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View } from 'react-native'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#5B331E',
        tabBarInactiveTintColor: '#9A8F87',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 74,
          paddingTop: 7,
          paddingBottom: 10,
          backgroundColor: '#FFFCF7',
          borderTopWidth: 1,
          borderTopColor: '#EEDFD2',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={23}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={23}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="sell"
        options={{
          title: 'Sell',
          tabBarIcon: () => (
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: '#5B331E',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -4,
              }}
            >
              <Ionicons
                name="add"
                size={24}
                color="#FFFFFF"
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={
                focused
                  ? 'chatbubble-ellipses'
                  : 'chatbubble-ellipses-outline'
              }
              size={23}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={23}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  )
}
