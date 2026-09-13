import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { analyzeToken, lookupMeanings } from '../language/api';
import { describeForm } from '../language/features';

type Ready = {
  status: 'ready';
  form: string;
  lemma: string;
  formLabel: string;
  glosses: string[];
  alsoLemmas: string[];
};
type LookupState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty'; form: string }
  | Ready;

function cleanToken(raw: string): string {
  return raw.replace(/^[^0-9A-Za-zÀ-ſ]+|[^0-9A-Za-zÀ-ſ]+$/gu, '');
}

// Tap-to-lookup card (Trello 31): resolve a tapped surface form to its meaning,
// base form, and current grammatical form. Analyze gives lemma + features;
// meanings gives the English gloss for that lemma. Meanings are fetched without a
// POS filter to maximize recall when the analyzer and dictionary disagree on POS.
export function WordLookup({
  word,
  languageCode = 'pl',
}: {
  word: string;
  languageCode?: string;
}) {
  const token = useMemo(() => cleanToken(word).toLocaleLowerCase('pl'), [word]);
  const [state, setState] = useState<LookupState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void (async () => {
      try {
        const analysis = await analyzeToken(languageCode, token);
        if (!active) return;
        const primary = analysis.analyses[0];
        if (!primary) {
          setState({ status: 'empty', form: token });
          return;
        }
        let glosses: string[] = [];
        try {
          const meanings = await lookupMeanings(languageCode, primary.lemma);
          if (!active) return;
          glosses = meanings.senses.map((sense) => sense.gloss);
        } catch {
          // A meanings miss still leaves a useful base-form/grammar card.
        }
        const alsoLemmas = [
          ...new Set(
            analysis.analyses
              .slice(1)
              .map((a) => a.lemma)
              .filter((lemma) => lemma !== primary.lemma),
          ),
        ];
        setState({
          status: 'ready',
          form: token,
          lemma: primary.lemma,
          formLabel: describeForm(primary.features, languageCode),
          glosses,
          alsoLemmas,
        });
      } catch {
        if (active) setState({ status: 'error' });
      }
    })();
    return () => {
      active = false;
    };
  }, [token, languageCode, revision]);

  if (!token) return <Text style={styles.muted}>No word selected.</Text>;
  if (state.status === 'loading')
    return (
      <ActivityIndicator accessibilityLabel="Looking up" color="#FFFFFF" />
    );
  if (state.status === 'error')
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setState({ status: 'loading' });
          setRevision((value) => value + 1);
        }}
      >
        <Text style={styles.muted}>Couldn’t look this up. Tap to retry.</Text>
      </Pressable>
    );
  if (state.status === 'empty')
    return (
      <View>
        <Text style={styles.headword}>{state.form}</Text>
        <Text style={styles.muted}>No dictionary entry yet.</Text>
      </View>
    );

  const showBase = state.lemma.toLocaleLowerCase('pl') !== state.form;
  return (
    <View accessibilityLiveRegion="polite">
      <Text style={styles.meaning}>
        {state.glosses.length > 0
          ? state.glosses.slice(0, 4).join('; ')
          : 'No meaning found.'}
      </Text>
      {showBase && (
        <Text style={styles.meta}>
          base form: <Text style={styles.metaStrong}>{state.lemma}</Text>
        </Text>
      )}
      {state.formLabel.length > 0 && (
        <Text style={styles.meta}>{state.formLabel}</Text>
      )}
      {state.alsoLemmas.length > 0 && (
        <Text style={styles.muted}>also: {state.alsoLemmas.join(', ')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  meaning: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  headword: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  meta: { color: '#EAF2EC', fontSize: 13, marginTop: 3 },
  metaStrong: { color: '#FFFFFF', fontWeight: '600' },
  muted: { color: '#C9D2CC', fontSize: 13, marginTop: 3 },
});
