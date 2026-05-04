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

interface MinimalGoogleMaps {
  importLibrary?: (name: string) => Promise<unknown>;
  places?: { Autocomplete: MinimalAutocompleteCtor };
}

declare global {
  interface Window {
    google?: { maps?: MinimalGoogleMaps };
    __teeWeathrMapsLoading__?: Promise<MinimalGoogleMaps>;
  }
}

const SCRIPT_ID = "google-maps-places-script";

// Module-scope so all instances share one script load. Safe across React
// strict-mode double-renders. Resolves to the maps namespace once loaded so
// callers don't have to re-poll for it.
function loadGoogleMaps(apiKey: string): Promise<MinimalGoogleMaps> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (window.__teeWeathrMapsLoading__) return window.__teeWeathrMapsLoading__;

  const promise = new Promise<MinimalGoogleMaps>((resolve, reject) => {
    const onLoad = () => {
      // Don't trust onload alone — with loading=async the namespace may
      // not be attached yet. Poll briefly.
      const start = Date.now();
      const check = () => {
        if (window.google?.maps) return resolve(window.google.maps);
        if (Date.now() - start > 5000) {
          return reject(new Error("Maps loaded but namespace missing — likely an auth/billing error in console"));
        }
        setTimeout(check, 25);
      };
      check();
    };

    if (document.getElementById(SCRIPT_ID)) {
      onLoad();
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    // Drop loading=async to avoid the timing race with the legacy
    // Autocomplete widget. The `defer` attribute already gives us
    // non-blocking parse.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = onLoad;
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });
  window.__teeWeathrMapsLoading__ = promise;
  return promise;
}

async function ensurePlaces(maps: MinimalGoogleMaps): Promise<{ Autocomplete: MinimalAutocompleteCtor }> {
  if (maps.places?.Autocomplete) return maps.places;
  // importLibrary handles the case where places lib loads on demand.
  if (maps.importLibrary) {
    const lib = (await maps.importLibrary("places")) as { Autocomplete: MinimalAutocompleteCtor };
    return lib;
  }
  throw new Error("Places library unavailable");
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

    (async () => {
      try {
        const maps = await loadGoogleMaps(apiKey);
        if (cancelled) return;
        const places = await ensurePlaces(maps);
        if (cancelled || !inputRef.current) return;

        autocomplete = new places.Autocomplete(inputRef.current, {
          // 'establishment' covers golf courses, country clubs, driving
          // ranges, etc. The human picking it is the filter.
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
      } catch (err) {
        if (cancelled) return;
        // Surface the real error in the browser console — almost always
        // an auth/referrer/billing problem on the API key. Google itself
        // also prints a detailed error to the console (e.g.
        // "ApiNotActivatedMapError", "RefererNotAllowedMapError",
        // "BillingNotEnabledMapError").
        // eslint-disable-next-line no-console
        console.error("[PlacesAutocomplete]", err);
        setStatus("error");
      }
    })();

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
