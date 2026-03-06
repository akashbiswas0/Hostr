'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, X, Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'

const LocationMapPreview = dynamic(() => import('./LocationMapPreview'), { ssr: false })

interface LocationPickerProps {
  value: string
  onChange: (address: string) => void
  onLocationChange: (data: { address: string; lat?: number; lng?: number }) => void
}

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
}

interface SelectedLocation {
  lat: number
  lng: number
  address: string
}

export default function LocationPicker({ value, onChange, onLocationChange }: LocationPickerProps) {
  const [localValue, setLocalValue] = useState(value)
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  // Debounced search
  useEffect(() => {
    const query = localValue.trim()

    if (query.length < 3) {
      setResults([])
      setIsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'en',
              'User-Agent': 'OnChainEvents/1.0',
            },
          }
        )
        const data: NominatimResult[] = await res.json()
        setResults(data)
        setIsOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [localValue])

  function handleSelect(item: NominatimResult) {
    const lat = parseFloat(item.lat)
    const lng = parseFloat(item.lon)
    const address = item.display_name

    setLocalValue(address)
    setSelectedLocation({ lat, lng, address })
    setResults([])
    setIsOpen(false)
    onLocationChange({ address, lat, lng })
    onChange(address)
  }

  function handleClear() {
    setLocalValue('')
    setSelectedLocation(null)
    setResults([])
    setIsOpen(false)
    onLocationChange({ address: '', lat: undefined, lng: undefined })
    onChange('')
  }

  return (
    <div ref={containerRef} className="w-full">
      {/* Text input */}
      <div className="relative w-full">
        <MapPin
          size={15}
          className="absolute left-2.5 top-2.5 text-[#ceb2d1] pointer-events-none"
        />
        <input
          type="text"
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value)
            if (selectedLocation) setSelectedLocation(null)
          }}
          placeholder="Search for a venue or address..."
          className="w-full rounded-lg border border-white/15 bg-[#7a527d]/45 px-3 py-2 pl-9 pr-9 text-sm text-[#f6ecf7] placeholder:text-[#ceb2d1] outline-none focus:border-fuchsia-200"
        />
        {loading ? (
          <Loader2
            size={15}
            className="absolute right-2.5 top-2.5 text-[#ceb2d1] animate-spin"
          />
        ) : localValue ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-2.5 text-[#ceb2d1] hover:text-white"
          >
            <X size={15} />
          </button>
        ) : null}

        {/* Autocomplete dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-white/15 bg-[#2b1231]/95 backdrop-blur-md shadow-2xl z-50 overflow-hidden">
            {results.length > 0 ? (
              results.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-white/10 transition-colors text-sm text-[#f6ecf7] w-full text-left"
                >
                  <MapPin size={14} className="shrink-0 mt-0.5 text-[#ceb2d1]" />
                  <span className="line-clamp-2">{item.display_name}</span>
                </button>
              ))
            ) : (
              <p className="text-center text-[#ceb2d1] py-4 text-sm">No results found</p>
            )}
          </div>
        )}
      </div>

      {/* Map preview */}
      {selectedLocation && (
        <LocationMapPreview
          lat={selectedLocation.lat}
          lng={selectedLocation.lng}
          address={selectedLocation.address}
        />
      )}
    </div>
  )
}
