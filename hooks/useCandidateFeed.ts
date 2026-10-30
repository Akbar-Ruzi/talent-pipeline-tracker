import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { ListFilters } from "@/types/candidate";
import { useCandidateDataset } from "@/context/candidate-dataset";
import { queryCandidates } from "@/lib/local/query";
import { PAGE_SIZE } from "@/lib/constants";

/**
 * -------------Mobile cards------------
 * a feed that grows as the user scrolls.
 * Phase 1 demo: every matching candidate is already in the combined academy +
 * local list, so "loading more" only shows the next PAGE_SIZE of them.
 * Already-shown cards stay.
 */
export function useCandidateFeed({ status, stage, search }: ListFilters) {
  const { candidates, academyLoading, academyError, retryAcademy } =
    useCandidateDataset();
  // How many matching cards are shown; grows by PAGE_SIZE as the user scrolls
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreAreaRef = useRef<HTMLDivElement>(null); //  points at the <div> around <LoadMore>, the element the scroll watcher looks at.
  const savedScrollRef = useRef<number | null>(null); // scroll position when a card was opened

  // Search or filters changed → start again from the first PAGE_SIZE cards.
  // Done during render (not in an effect), so the old count is never shown under the new filters.
  // A local create or edit keeps visibleCount, so the cards the user scrolled to stay put.
  const filterKey = `${status ?? ""}|${stage ?? ""}|${search ?? ""}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(PAGE_SIZE);
  }

  const matches = useMemo(
    () => queryCandidates(candidates, { status, stage, search }),
    [candidates, status, stage, search],
  );
  const shown = useMemo(
    () => matches.slice(0, visibleCount),
    [matches, visibleCount],
  );

  // cacheComponents keeps this page alive (hidden in React <Activity>) while the
  // user is on a candidate's full page. State survives, so visibleCount and the
  // cards are still here; this effect re-runs when the page shows again.
  // Navigation scrolls to the top, so scroll back to where the card was opened.
  // Two frames, so it runs after the navigation's own scroll.
  useEffect(() => {
    const y = savedScrollRef.current;
    if (y === null) return;
    // Not cleared here: in dev React runs this effect twice, and the first
    // run's cleanup cancels the frame. Clearing late lets the second run scroll.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        savedScrollRef.current = null; // cleared only once it has scrolled
        window.scrollTo(0, y);
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Called when a card opens the full page
  const rememberScroll = () => {
    savedScrollRef.current = window.scrollY;
  };

  const loadMore = () => {
    if (visibleCount >= matches.length) return; // everything is shown
    // Not a functional update: if the observer fires twice before a render,
    // both calls set the same value, so no page is skipped
    setVisibleCount(visibleCount + PAGE_SIZE);
  };

  // Called by the observer. useEffectEvent always sees the latest state,
  // so the observer doesn't need to be recreated when loadMore changes.
  const onLoadMoreAreaVisible = useEffectEvent(() => loadMore());
  /* The flow is: the observer sees the area → its callback checks it's visible → it calls onLoadMoreAreaVisible → that calls loadMore(). */
  useEffect(() => {
    const area = loadMoreAreaRef.current;
    if (!area) return; // the cards aren't on screen (loading, error, or empty)
    // An IntersectionObserver is observer,  watches the area under the last card. When that area comes within 200px of the screen (rootMargin),
    //  it shows the next cards, so they are usually ready before the user reaches the bottom.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMoreAreaVisible();// Runs on every report and checks isIntersecting, meaning "is the area visible now?"
      },
      { rootMargin: "200px" }, // start a little before the user reaches the end
    );
    observer.observe(area);
    return () => observer.disconnect();
    // loading/error: the area only exists once the cards are shown.
    // shown.length: re-observe after each batch, so if the area is
    // still in view the observer reports it again and the next batch shows.
  }, [academyLoading, academyError, shown.length]);

  return {
    candidates: shown,
    total: matches.length,
    loading: academyLoading,
    error: academyError,
    retry: retryAcademy,
    // Kept so <LoadMore> works unchanged: slicing a loaded list can't be slow or fail
    loadingMore: false,
    loadMoreError: null,
    loadMore,
    rememberScroll, // call when a card opens the full page
    loadMoreAreaRef, // attach to the wrapper around <LoadMore>
  };
}
