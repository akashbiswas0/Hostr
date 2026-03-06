import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { MapPin } from 'lucide-react'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface EventDetailMapProps {
  lat: number
  lng: number
  title: string
  address?: string
}

export default function EventDetailMap({ lat, lng, title, address }: EventDetailMapProps) {
  return (
    <>
      <div className="relative rounded-2xl overflow-hidden">
        <MapContainer
          center={[lat, lng]}
          zoom={15}
          scrollWheelZoom={false}
          style={{ height: '240px', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />
          <Marker position={[lat, lng]}>
            <Popup>{title}</Popup>
          </Marker>
        </MapContainer>
        <div className="absolute inset-0 bg-fuchsia-900/10 pointer-events-none z-[1000]" />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm text-[#ceb2d1]">
          <MapPin size={13} /> {address}
        </span>
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-fuchsia-300 hover:text-fuchsia-200 transition-colors"
        >
          Open in maps →
        </a>
      </div>
    </>
  )
}
