"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";

// Migrated to PlaceAutocompleteElement (the new web-component-based widget).
// As of March 2025, Google deprecated the legacy google.maps.places.Autocomplete
// for new GCP projects, so the old widget literally won't authorize on a
// freshly-provisioned key. The new element only needs Places API (New).

// Minimal types so we don't need @types/google.maps installed. The actual
// surface area is wider; we type only what we touch.
interface GooglePlace {
  id: string;
  displayName?: string;
  formattedAddress?: string;
  fetchFields(opts: { fields: string[] }): Promise<unknown>;
}

interface PlacePrediction {
  toPlace(): GooglePlace;
  placeId?: string;
  text?: { text?: string } | string;
}

// The shape varies across Maps JS versions:
//   - { detail: { placePrediction } } → call .toPlace() then fetchFields
//   - { detail: { place } } → already a Place, fetchFields directly
//   - top-level { placePrediction } / { place } on the event itself
// We probe all four below.
type LooseSelectEvent = Event & {
  detail?: { placePrediction?: PlacePrediction; place?: GooglePlace };
  placePrediction?: PlacePrediction;
  place?: GooglePlace;
};

// The custom element we instantiate. Properties below are documented on
// Google's Places web-components reference.
interface PlaceAutocompleteEl extends HTMLElement {
  includedPrimaryTypes?: string[];
  includedRegionCodes?: string[];
  requestedLanguage?: string;
}

interface PlaceAutocompleteCtor {
  new (): PlaceAutocompleteEl;
}

interface MinimalPlaces {
  PlaceAutocompleteElement?: PlaceAutocompleteCtor;
}

interface MinimalGoogleMaps {
  importLibrary?: (name: string) => Promise<unknown>;
  places?: MinimalPlaces;
}

declare global {
  interface Window {
    google?: { maps?: MinimalGoogleMaps };
    __teeWeathrMapsLoading__?: Promise<MinimalGoogleMaps>;
  }
}

const SCRIPT_ID = "google-maps-places-script";

function loadGoogleMaps(apiKey: string): Promise<MinimalGoogleMaps> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (window.__teeWeathrMapsLoading__) return window.__teeWeathrMapsLoading__;

  const promise = new Promise<MinimalGoogleMaps>((resolve, reject) => {
    const onLoad = () => {
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

async function ensurePlaceElement(maps: MinimalGoogleMaps): Promise<PlaceAutocompleteCtor> {
  if (maps.places?.PlaceAutocompleteElement) return maps.places.PlaceAutocompleteElement;
  if (maps.importLibrary) {
    const lib = (await maps.importLibrary("places")) as MinimalPlaces;
    if (lib.PlaceAutocompleteElement) return lib.PlaceAutocompleteElement;
  }
  throw new Error("PlaceAutocompleteElement unavailable — ensure Places API (New) is enabled");
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
  const containerRef = useRef<HTMLDivElement>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no-key">(
    apiKey ? "loading" : "no-key"
  );

  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let cancelled = false;
    let element: PlaceAutocompleteEl | null = null;

    (async () => {
      try {
        const maps = await loadGoogleMaps(apiKey);
        if (cancelled) return;
        const Ctor = await ensurePlaceElement(maps);
        if (cancelled || !containerRef.current) return;

        const el = new Ctor();
        // No primary-type filter — the new Places API uses a stricter
        // "Table A" type list and 'establishment' (Table B from the legacy
        // API) silently drops every result. The user typing the course
        // name is filter enough.
        if (countryRestriction) {
          const codes = Array.isArray(countryRestriction) ? countryRestriction : [countryRestriction];
          el.includedRegionCodes = codes.map((c) => c.toUpperCase());
        }
        if (placeholder) {
          // The inner input picks up the placeholder via the attribute.
          el.setAttribute("placeholder", placeholder);
        }

        // Style hooks for our dark theme. The element renders its own input
        // inside shadow DOM; we expose CSS variables it respects + match the
        // outer wrapper to our zinc theme. Final polish comes from the
        // wrapper div's classes below.
        el.style.width = "100%";

        containerRef.current.appendChild(el);
        element = el;

        const handleSelect = async (ev: Event) => {
          const e = ev as LooseSelectEvent;
          // eslint-disable-next-line no-console
          console.log("[PlacesAutocomplete] selection event", ev.type, { detail: e.detail, top: { placePrediction: e.placePrediction, place: e.place } });

          // Defensively extract a Place across API surface variants.
          let place: GooglePlace | null =
            e.detail?.place ??
            e.place ??
            (e.detail?.placePrediction ? e.detail.placePrediction.toPlace() : null) ??
            (e.placePrediction ? e.placePrediction.toPlace() : null);

          if (!place) {
            // eslint-disable-next-line no-console
            console.error("[PlacesAutocomplete] could not extract Place from event", ev);
            return;
          }

          try {
            await place.fetchFields({ fields: ["id", "displayName", "formattedAddress"] });
            if (cancelled) return;
            onSelect({
              placeId: place.id,
              name: place.displayName ?? "",
              address: place.formattedAddress ?? "",
            });
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error("[PlacesAutocomplete] place fetch failed", err);
          }
        };
        // Listen for both names — Google has shipped both. Older docs say
        // gmp-placeselect; current docs say gmp-select.
        el.addEventListener("gmp-select", handleSelect);
        el.addEventListener("gmp-placeselect", handleSelect);

        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error("[PlacesAutocomplete]", err);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    };
  }, [apiKey, onSelect, countryRestriction, placeholder]);

  if (status === "no-key") {
    return (
      <div className="rounded-lg border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
        Course search isn&rsquo;t configured yet (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY missing). Contact support.
      </div>
    );
  }

  return (
    <div className="relative" aria-disabled={disabled}>
      {/* The Place Autocomplete element renders inside this wrapper. The
          element manages its own input + dropdown. Wrapper provides our
          rounded border + dark background; element handles the rest. */}
      <div ref={containerRef} className="places-autocomplete-host" />
      {status === "loading" && (
        <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 animate-spin" />
      )}
      {status === "error" && (
        <MapPin className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-red-400" />
      )}
    </div>
  );
}
