import L from "leaflet"
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png"
import markerIcon from "leaflet/dist/images/marker-icon.png"
import markerShadow from "leaflet/dist/images/marker-shadow.png"

/** Self-hosted marker images: CSP `img-src` does not allow third-party CDNs. */
export const fixLeafletIcons = () => {
  const proto = L.Icon.Default.prototype as unknown as {
    _getIconUrl?: string
  }
  delete proto._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x.src,
    iconUrl: markerIcon.src,
    shadowUrl: markerShadow.src,
  })
}
