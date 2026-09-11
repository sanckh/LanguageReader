import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { AccountScreen } from '../screens/AccountScreen';
import { LearnerScreen } from '../screens/LearnerScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { ReaderScreen } from '../screens/ReaderScreen';
import { colors } from '../theme';

export type RootTabParamList = {
  Reader: { documentId?: string } | undefined;
  Library: undefined;
  Learner: undefined;
  Account: undefined;
};
const Tab = createBottomTabNavigator<RootTabParamList>();
const symbols = { Reader: 'Aa', Library: '▤', Learner: '◒', Account: '○' };
export function AppNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Reader"
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color }) => (
          <Text accessible={false} style={{ color, fontSize: 22 }}>
            {symbols[route.name]}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Reader" component={ReaderScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Learner" component={LearnerScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}
