import Constants from 'expo-constants';
import { ConnectionCheck } from '../components/ConnectionCheck';
import { PlaceholderScreen } from '../components/PlaceholderScreen';
export function AccountScreen() {
  return (
    <PlaceholderScreen
      title="Your own space."
      description="A home for your reading preferences."
      emptyTitle="You are not signed in"
      emptyDescription="Account creation and sign-in are coming in a later step. This app shell does not store personal data yet."
    >
      {(__DEV__ || Constants.expoConfig?.extra?.environment === 'preview') && (
        <ConnectionCheck />
      )}
    </PlaceholderScreen>
  );
}
