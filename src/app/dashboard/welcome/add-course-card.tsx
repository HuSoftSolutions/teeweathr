"use client";

import { useCallback, useState } from "react";
import { Flag, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { PlacesAutocomplete, type SelectedPlace } from "@/components/places-autocomplete";

export function AddCourseCard() {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelect = useCallback(
    async (place: SelectedPlace) => {
      setSelected(place);
      setState("saving");
      setErrorMsg(null);
      try {
        const res = await fetch("/api/dashboard/courses/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placeId: place.placeId }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setState("error");
          setErrorMsg(data.error || "Could not add course");
          return;
        }
        setState("saved");
        // Refresh the server-rendered welcome page so the banner disappears
        // and the snippet section reflects the new state.
        router.refresh();
      } catch {
        setState("error");
        setErrorMsg("Network error — please try again");
      }
    },
    [router]
  );

  return (
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 mb-6">
      <div className="flex items-start gap-3 mb-4">
        <Flag className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-base font-semibold text-amber-200 mb-1">One more step: pick your course</h2>
          <p className="text-sm text-zinc-300">
            Search for your course on Google. We&rsquo;ll grab the address and coordinates for you.
          </p>
        </div>
      </div>

      <PlacesAutocomplete
        onSelect={handleSelect}
        placeholder="e.g. Pebble Beach Golf Links"
        countryRestriction={["us", "ca"]}
        disabled={state === "saving" || state === "saved"}
      />

      {state === "saving" && (
        <div className="mt-3 flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Adding {selected?.name ?? "course"}...
        </div>
      )}
      {state === "saved" && selected && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{selected.name} added</p>
            <p className="text-xs text-emerald-300/80">{selected.address}</p>
          </div>
        </div>
      )}
      {state === "error" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p>{errorMsg}</p>
            <button
              type="button"
              onClick={() => { setState("idle"); setErrorMsg(null); setSelected(null); }}
              className="text-xs underline text-red-300 hover:text-red-200 mt-1"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
