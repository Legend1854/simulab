import { useEffect, useState } from 'react';
import { activeSessionOf } from '../../app/store';
import { useAppState } from '../../app/StoreContext';
import { ResultsScreen } from './ResultsScreen';
import { RoundReview } from './RoundReview';
import { SimulationScreen } from './SimulationScreen';
import { StartScreen } from './StartScreen';

/**
 * Student flow: start -> (decide -> review) x rounds -> results.
 * The review step is UI-only state; reloading the page skips straight to the next decision,
 * where the previous round's summary is still shown.
 */
export function StudentPage() {
  const state = useAppState();
  const session = activeSessionOf(state);
  const [reviewRound, setReviewRound] = useState<number | null>(null);

  useEffect(() => {
    // A different (or no) active session invalidates any pending review.
    setReviewRound(null);
  }, [session?.id]);

  if (!session) return <StartScreen />;
  if (reviewRound !== null && session.results[reviewRound - 1]) {
    return <RoundReview session={session} round={reviewRound} onContinue={() => setReviewRound(null)} />;
  }
  if (session.status === 'complete') return <ResultsScreen session={session} />;
  return <SimulationScreen session={session} onSubmitted={setReviewRound} />;
}
