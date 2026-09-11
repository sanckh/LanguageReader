import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthProvider';
import { LibraryView } from '../library/LibraryView';
import { getLibrary } from '../library/api';
import type { LibraryBook } from '../interfaces/library';
import type { LibraryScope } from '../models/library';
import type { RootTabParamList } from '../navigation/AppNavigator';

export function LibraryScreen() {
  const { session } = useAuth();
  return (
    <LibraryController
      key={session?.user.id ?? 'signed-out'}
      signedIn={Boolean(session)}
    />
  );
}

function LibraryController({ signedIn }: { signedIn: boolean }) {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const [selection, setSelection] = useState({
    scope: 'included' as LibraryScope,
    revision: 0,
  });
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(signedIn);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!signedIn) return;
      const controller = new AbortController();
      let active = true;
      setLoading(true);
      setError(null);
      setBooks([]);
      const timer = setTimeout(() => controller.abort(), 15000);
      getLibrary(selection.scope, controller.signal)
        .then((data) => {
          if (active) setBooks(data);
        })
        .catch(() => {
          if (active)
            setError(
              'We couldn’t load your books. Check your connection and try again.',
            );
        })
        .finally(() => {
          clearTimeout(timer);
          if (active) setLoading(false);
        });
      return () => {
        active = false;
        controller.abort();
        clearTimeout(timer);
      };
    }, [signedIn, selection]),
  );

  return (
    <LibraryView
      books={books}
      loading={loading}
      error={error}
      signedIn={signedIn}
      scope={selection.scope}
      onScopeChange={(next) => {
        setBooks([]);
        setLoading(signedIn);
        setSelection((value) => ({
          scope: next,
          revision: value.revision + 1,
        }));
      }}
      onRetry={() =>
        setSelection((value) => ({ ...value, revision: value.revision + 1 }))
      }
      onSignIn={() => navigation.navigate('Account')}
    />
  );
}
