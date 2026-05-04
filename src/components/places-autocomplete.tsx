"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";

// Minimal types so we don't need @types/google.maps installed.
interface MinimalAutocomplete {
  addListener: (event: string, cb: () => void) => void;
  getPlace: () => {
    place_id?: string;
    name?: string;
    formatted_address?: string;
  } | null;
}

interface MinimalAutocompleteCtor {
  new (input: HTMLInputElement, opts: {
    types?: string[];
    fields?: string[];
    componentRestrictions?: { country?: string | string[] };
  }): MinimalAutocomplete;
}

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: { Autocomplete: MinimalAutocompleteCtor };
      };
    };
    __teeWeathrMapsLoading__?: Promise<void>;
  }
}

const SCRIPT_ID = "google-maps-places-script";

// Module-scope so all instances share one script load. Safe across React
// strict-mode double-renders.
function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__teeWeathrMapsLoading__) return window.__teeWeathrMapsLoading__;

  const promise = new Promise<void>((resolve, reject) => {
    if (document.getElementById(SCRIPT_ID)) {
      // Already injected by another instance — wait for it.
      const check = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(check);
          resolve();
        }
      }, 50);
      setTimeout(() => { clearInterval(check); reject(new Error("Maps script timed out")); }, 10_000);
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  window.__teeWeathrMapsLoading__ = promise;
  return promise;
}

export type SelectedPlace = {
  placeId: string;
  name: string;
  address: string;
};

export function PlacesAutocomplete({
  onSelect,
  placeholder = "Search for your course",
  countryRestriction,
  disabled = false,
}: {
  onSelect: (place: SelectedPlace) => void;
  placeholder?: string;
  countryRestriction?: string | string[];
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no-key">(
    apiKey ? "loading" : "no-key"
  );

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;
    let cancelled = false;
    let autocomplete: MinimalAutocomplete | null = null;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled) return;
        const ctor = window.google?.maps?.places?.Autocomplete;
        if (!ctor || !inputRef.current) {
          setStatus("error");
          return;
        }
        autocomplete = new ctor(inputRef.current, {
          // 'establishment' is broader than 'golf_course' but covers more
          // golf-adjacent results (driving ranges, country clubs). Server
          // doesn't restrict by type — the human picking it is the filter.
          types: ["establishment"],
          fields: ["place_id", "name", "formatted_address"],
          ...(countryRestriction ? { componentRestrictions: { country: countryRestriction } } : {}),
        });
        autocomplete.addListener("place_changed", () => {
          const p = autocomplete!.getPlace();
          if (!p?.place_id) return;
          onSelect({
            placeId: p.place_id,
            name: p.name ?? "",
            address: p.formatted_address ?? "",
          });
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, onSelect, countryRestriction]);

  if (status === "no-key") {
    return (
      <div className="rounded-lg border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
        Course search isn&rsquo;t configured yet (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY missing). Contact support.
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        disabled={disabled || status !== "ready"}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-10 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600 disabled:opacity-50"
        autoComplete="off"
      />
      {status === "loading" && (
        <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 animate-spin" />
      )}
      {status === "error" && (
        <MapPin className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-red-400" />
      )}
    </div>
  );
}
