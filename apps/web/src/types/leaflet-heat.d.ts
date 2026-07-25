// leaflet.heat ships no types of its own — this augments the `leaflet`
// module with just the bits this app actually calls.
import 'leaflet';

declare module 'leaflet' {
  interface HeatLayerOptions {
    radius?: number;
    blur?: number;
    maxZoom?: number;
    max?: number;
    gradient?: Record<number, string>;
  }

  type HeatLatLngTuple = [number, number, number?];

  function heatLayer(latlngs: HeatLatLngTuple[], options?: HeatLayerOptions): Layer;
}

declare module 'leaflet.heat';
