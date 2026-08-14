"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Search, Loader2, X, Bookmark, BookmarkPlus, Trash2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Fix default marker icon
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

// Parse plain coordinates or Google Maps URLs into lat/lng
function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();
  let m: RegExpMatchArray | null = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) {
    m = trimmed.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
      || trimmed.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
      || trimmed.match(/[?&](?:q|ll|query|center)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  }
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

interface SavedLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface LocationPickerProps {
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  onChange: (data: { location: string; latitude: number | null; longitude: number | null }) => void;
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 15));
  }, [lat, lng, map]);
  return null;
}

export function LocationPicker({ location, latitude, longitude, onChange }: LocationPickerProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState(location || "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const hasCoords = latitude != null && longitude != null;
  const center: [number, number] = hasCoords ? [latitude!, longitude!] : [14.5995, 120.9842]; // Default: Manila

  const doSearch = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        { headers: { "Accept-Language": "en" } }
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setShowResults(true);
      }
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setSearching(false);
    }
  }, []);

  const reverseGeocode = useCallback((lat: number, lng: number) => {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`)
      .then(res => res.json())
      .then(data => {
        if (data.display_name) {
          setSearchQuery(data.display_name);
          onChange({ location: data.display_name, latitude: lat, longitude: lng });
        }
      })
      .catch(() => {});
  }, [onChange]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const coords = parseCoordinates(value);
    if (coords) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setResults([]);
      setShowResults(false);
      onChange({ location: `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`, latitude: coords.lat, longitude: coords.lng });
      reverseGeocode(coords.lat, coords.lng);
      return;
    }
    onChange({ location: value, latitude: null, longitude: null });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 400);
  };

  const handleSelectResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setSearchQuery(result.display_name);
    setShowResults(false);
    onChange({ location: result.display_name, latitude: lat, longitude: lng });
  };

  const handleMapClick = (lat: number, lng: number) => {
    onChange({ location: searchQuery || `${lat.toFixed(6)}, ${lng.toFixed(6)}`, latitude: lat, longitude: lng });
    reverseGeocode(lat, lng);
  };

  const handleMarkerDrag = (e: L.DragEndEvent) => {
    const pos = (e.target as L.Marker).getLatLng();
    onChange({ location: searchQuery || `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`, latitude: pos.lat, longitude: pos.lng });
    reverseGeocode(pos.lat, pos.lng);
  };

  const handleClear = () => {
    setSearchQuery("");
    setResults([]);
    setShowResults(false);
    onChange({ location: "", latitude: null, longitude: null });
  };

  const fetchSavedLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/saved-locations");
      if (res.ok) setSavedLocations(await res.json());
    } catch (e) { console.error("Error fetching saved locations:", e); }
  }, []);

  useEffect(() => { fetchSavedLocations(); }, [fetchSavedLocations]);

  const handleSelectSaved = (loc: SavedLocation) => {
    setSearchQuery(loc.address);
    setShowResults(false);
    onChange({ location: loc.address, latitude: loc.latitude, longitude: loc.longitude });
  };

  const handleSaveLocation = async () => {
    if (!saveName.trim() || !hasCoords) return;
    setSavingLocation(true);
    try {
      const res = await fetch("/api/saved-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveName.trim(), address: searchQuery, latitude, longitude }),
      });
      if (res.ok) {
        toast({ title: "Location saved" });
        setSaveName("");
        setShowSaveDialog(false);
        fetchSavedLocations();
      } else {
        toast({ title: "Failed to save location", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save location", variant: "destructive" });
    } finally {
      setSavingLocation(false);
    }
  };

  const handleDeleteSaved = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/saved-locations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSavedLocations(savedLocations.filter(l => l.id !== id));
        toast({ title: "Location removed" });
      }
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Close results when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="space-y-2">
      <Label>Location</Label>

      {/* Search input with autocomplete */}
      <div className="relative" ref={resultsRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search a place, or paste coordinates / Maps link..."
          className="pl-10 pr-9 rounded-xl"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!searching && searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Autocomplete dropdown */}
        {showResults && results.length > 0 && (
          <div className="absolute z-[1000] mt-1 w-full bg-popover border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.place_id}
                onClick={() => handleSelectResult(r)}
                className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b border-border/40 last:border-0"
              >
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground line-clamp-2">{r.display_name}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-border/40 h-64 bg-muted/30">
        <MapContainer
          center={center}
          zoom={hasCoords ? 15 : 5}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
          whenReady={() => setMapReady(true)}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution=""
          />
          {hasCoords && (
            <>
              <Marker position={[latitude!, longitude!]} draggable eventHandlers={{ dragend: handleMarkerDrag }} />
              <RecenterMap lat={latitude!} lng={longitude!} />
            </>
          )}
          <ClickHandler onMapClick={handleMapClick} />
        </MapContainer>

        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Hint overlay */}
        <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg inline-block">
            {hasCoords ? "Click map or drag pin to adjust" : "Click map to set location"}
          </div>
        </div>
      </div>

      {hasCoords && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {latitude!.toFixed(4)}, {longitude!.toFixed(4)}
          </p>
          <button
            onClick={() => setShowSaveDialog(!showSaveDialog)}
            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium"
          >
            <BookmarkPlus className="h-3 w-3" />
            Save this location
          </button>
        </div>
      )}

      {/* Save dialog */}
      {showSaveDialog && hasCoords && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-border/40 bg-muted/30">
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Tag name (e.g. Kingdom Hall, Assembly Hall)"
            className="rounded-lg h-9"
            onKeyDown={(e) => e.key === "Enter" && handleSaveLocation()}
          />
          <Button
            onClick={handleSaveLocation}
            disabled={!saveName.trim() || savingLocation}
            size="sm"
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 shrink-0"
          >
            {savingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button
            onClick={() => { setShowSaveDialog(false); setSaveName(""); }}
            variant="ghost"
            size="sm"
            className="rounded-lg shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Saved locations chips */}
      {savedLocations.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Bookmark className="h-3 w-3" />
            Saved Locations
          </p>
          <div className="flex flex-wrap gap-1.5">
            {savedLocations.map((loc) => (
              <div
                key={loc.id}
                className="group flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-card border border-border/40 text-xs hover:border-indigo-300 transition-colors"
              >
                <button
                  onClick={() => handleSelectSaved(loc)}
                  className="flex items-center gap-1.5 text-foreground"
                >
                  <MapPin className="h-3 w-3 text-indigo-500" />
                  <span className="font-medium">{loc.name}</span>
                </button>
                <button
                  onClick={(e) => handleDeleteSaved(loc.id, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 p-0.5"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
