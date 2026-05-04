import { useState, useCallback, useEffect } from "react";
import type { GolfCourse } from "./courses";

const STORAGE_KEY = "teeweathr-favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<GolfCourse[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount (deferred to avoid sync setState in effect)
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setFavorites(JSON.parse(raw));
      } catch { /* ignore corrupt data */ }
      setLoaded(true);
    });
  }, []);

  // Persist whenever favorites change (skip initial load)
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch { /* storage full, ignore */ }
  }, [favorites, loaded]);

  const isFavorite = useCallback(
    (courseId: string) => favorites.some((c) => c.id === courseId),
    [favorites]
  );

  const toggleFavorite = useCallback((course: GolfCourse) => {
    setFavorites((prev) => {
      const exists = prev.some((c) => c.id === course.id);
      if (exists) return prev.filter((c) => c.id !== course.id);
      return [...prev, course];
    });
  }, []);

  return { favorites, isFavorite, toggleFavorite, loaded };
}
