'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  TELEMETRY_EVENTS,
  TELEMETRY_BACKEND_CONTRACT,
  createTelemetryContext,
  createTelemetrySocket,
  emitJoinRoom,
  normalizeRoomInputOrFallback,
  parseTelemetryPayload,
  validateTelemetryBackendContract,
  type TelemetryEventDto,
} from '../../lib/telemetry-socket';

type LiveDriver = TelemetryEventDto & {
  lastSeenAt: number;
};

type LiveDriverPoint = {
  latitude: number;
  longitude: number;
  at: number;
};

type SimulationState = {
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading: number;
  driverName: string;
  cargoName: string;
  sourceCity: string;
  destinationCity: string;
  truckModel: string;
};

type LiveMapProps = {
  companyId?: string | null;
  simulationDriverCount?: number | null;
};

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then((mod) => mod.Polyline), { ssr: false });

const MapUpdater = dynamic(
  () =>
    import('react-leaflet').then(({ useMap }) => {
      return function MapUpdater({
        followLat,
        followLng,
        followDriverId,
      }: {
        followLat?: number;
        followLng?: number;
        followDriverId: string | null;
      }) {
        const map = useMap();

        useEffect(() => {
          if (!followDriverId || typeof followLat !== 'number' || typeof followLng !== 'number') {
            return;
          }

          map.flyTo([followLat, followLng], 11.6, {
            animate: true,
            duration: 0.9,
          });
        }, [followDriverId, followLat, followLng, map]);

        return null;
      };
    }),
  { ssr: false },
);

const MapBoundsMonitor = dynamic(
  () =>
    import('react-leaflet').then(({ useMapEvents }) => {
      return function MapBoundsMonitor({
        onBoundsChange,
      }: {
        onBoundsChange: (bounds: L.LatLngBounds | null) => void;
      }) {
        useMapEvents({
          load(event) {
            onBoundsChange(event.target.getBounds());
          },
          moveend(event) {
            onBoundsChange(event.target.getBounds());
          },
          zoomend(event) {
            onBoundsChange(event.target.getBounds());
          },
        });

        return null;
      };
    }),
  { ssr: false },
);

const ClusteredDriverLayer = dynamic(
  () =>
    import('react-leaflet').then(({ useMap }) => {
      return function ClusteredDriverLayer({
        drivers,
        selectedDriverId,
        performanceMode,
        onSelectDriver,
      }: {
        drivers: LiveDriver[];
        selectedDriverId: string | null;
        performanceMode: boolean;
        onSelectDriver: (driverId: string) => void;
      }) {
        const map = useMap();
        const clusterRef = useRef<L.FeatureGroup | null>(null);
        const isMountedRef = useRef(true);
        const pluginLoadedRef = useRef(false);

        useEffect(() => {
          isMountedRef.current = true;
          let group = clusterRef.current;
          const densityProfile = resolveClusterDensityProfile(drivers.length, performanceMode);
          const hasDenseDrivers = drivers.length > densityProfile.tooltipDensityLimit;
          const onZoomRefresh = () => {
            const targetGroup = group || clusterRef.current;
            const pluginGroup = targetGroup as { refreshClusters?: () => void };
            pluginGroup.refreshClusters?.();
          };

          const syncLayers = async () => {
            let markerCluster = (L as typeof L & { markerClusterGroup?: unknown }).markerClusterGroup;
            if (!markerCluster && !pluginLoadedRef.current) {
              try {
                await import('leaflet.markercluster');
                pluginLoadedRef.current = true;
                markerCluster = (L as typeof L & { markerClusterGroup?: unknown }).markerClusterGroup;
              } catch {
                return;
              }
            }

            if (!isMountedRef.current || !markerCluster) {
              return;
            }

            const clusterRadiusByZoom = (zoom: number) => {
              if (zoom >= 15) {
                return 18 + densityProfile.clusterRadiusOffset;
              }
              if (zoom >= 12) {
                return 28 + densityProfile.clusterRadiusOffset;
              }
              if (zoom >= 9) {
                return 40 + densityProfile.clusterRadiusOffset;
              }
              return 56 + densityProfile.clusterRadiusOffset;
            };

            if (!group) {
              group = (L as unknown as { markerClusterGroup: (options: Record<string, unknown>) => L.FeatureGroup }).markerClusterGroup({
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true,
                animate: densityProfile.animate,
                animateAddingMarkers: densityProfile.animate,
                removeOutsideVisibleBounds: true,
                maxClusterRadius: clusterRadiusByZoom,
                disableClusteringAtZoom: densityProfile.disableClusteringAtZoom,
                spiderfyDistanceMultiplier: 1.3,
                spiderfyOnEveryZoom: true,
                chunkedLoading: densityProfile.chunkedLoading,
                chunkInterval: densityProfile.chunkInterval,
                chunkDelay: densityProfile.chunkDelay,
                iconCreateFunction: (cluster: { getChildCount: () => number }) => {
                  const count = cluster.getChildCount();
                  return createGoldClusterMarker(count);
                },
              }) as unknown as L.FeatureGroup;

              group.addTo(map);
              clusterRef.current = group;
            }

            group.clearLayers();
            map.on('zoomend', onZoomRefresh);
            for (const driver of drivers) {
              const marker = L.marker([driver.latitude, driver.longitude], {
                icon: createGoldMarker(driver, selectedDriverId === driver.driverId),
                riseOnHover: true,
                keyboard: false,
              });

              const tooltipHtml = createDriverTooltipHtml(driver);
              const attachTooltip = () => {
                if (!marker.getTooltip()) {
                  marker.bindTooltip(tooltipHtml, {
                    direction: 'top',
                    offset: [0, -16],
                    opacity: 0.96,
                    sticky: true,
                    className: 'telemetry-marker-tooltip',
                  });
                }
              };

              if (!hasDenseDrivers) {
                attachTooltip();
              } else {
                marker.on('mouseover', () => {
                  attachTooltip();
                  marker.openTooltip();
                });
                marker.on('mouseout', () => {
                  marker.closeTooltip();
                });
              }

              marker.on('click', () => {
                onSelectDriver(driver.driverId);
                if (hasDenseDrivers) {
                  attachTooltip();
                }
              });

              group.addLayer(marker);
            }
          };

          syncLayers();

          return () => {
            isMountedRef.current = false;
            map.off('zoomend', onZoomRefresh);
            if (group) {
              map.removeLayer(group);
              group = null;
              clusterRef.current = null;
            }
          };
        }, [drivers, selectedDriverId, map, onSelectDriver, performanceMode]);

        return null;
      };
    }),
  { ssr: false },
);

type LiveMapStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error' | 'empty';

type LiveMapStatusMeta = {
  text: string;
  colorClass: string;
  badgeClass: string;
};

const SOCKET_STATUS_META: Record<LiveMapStatus, LiveMapStatusMeta> = {
  connecting: {
    text: 'Verbinde',
    colorClass: 'text-gold-200',
    badgeClass: 'bg-gold-300',
  },
  connected: {
    text: 'Live',
    colorClass: 'text-emerald-200',
    badgeClass: 'bg-emerald-400',
  },
  reconnecting: {
    text: 'Reconnect',
    colorClass: 'text-amber-200',
    badgeClass: 'bg-amber-400',
  },
  disconnected: {
    text: 'Getrennt',
    colorClass: 'text-red-200',
    badgeClass: 'bg-red-400',
  },
  error: {
    text: 'Fehler',
    colorClass: 'text-red-200',
    badgeClass: 'bg-red-500',
  },
  empty: {
    text: 'Warte',
    colorClass: 'text-gold-200',
    badgeClass: 'bg-gold-300',
  },
};

const EUROPE_CENTER: [number, number] = [50.1109, 8.6821];
const MAX_DRIVER_STALE_MS = 60_000;
const CLEANUP_INTERVAL_MS = 12_000;
const SOCKET_READY_TIMEOUT_MS = 4200;
const REJOIN_DEBOUNCE_MS = 260;
const MAP_RENDER_DEBOUNCE_MS = 140;
const TRAIL_MAX_POINTS = 60;
const TRAIL_MAX_AGE_MS = 150_000;
const TRAIL_WINDOW_MIN = 6;
const TRAIL_WINDOW_MAX = 40;
const TRAIL_WINDOW_DEFAULT = 18;
const MAX_TRAIL_RENDER_OFFSCREEN = 12;
const PERFORMANCE_TRAIL_RENDER_OFFSCREEN = 7;
const TRAIL_VIEWPORT_PADDING = 0.26;
const STANDARD_TRAIL_DECIMATION_STEP = 3;
const PERFORMANCE_TRAIL_DECIMATION_STEP = 5;
const VIEWPORT_PADDING = 0.18;
const MAX_LIST_ITEMS = 200;
const MAX_LIST_ITEMS_PERF = 120;
const MAX_TOOLTIP_DENSITY_STANDARD = 120;
const MAX_TOOLTIP_DENSITY_PERFORMANCE = 70;
const LIVE_MAP_PERFORMANCE_MODE_KEY = 'vtc_live_map_performance_mode';
const LIVE_MAP_PERFORMANCE_MODE_AUTO_KEY = 'vtc_live_map_performance_mode_auto';
const LIVE_MAP_SIMULATION_SPEED_LIMITS = [500, 1000, 3000] as const;
const AUTO_HIGH_DENSITY_ENABLE_THRESHOLD = 180;
const AUTO_HIGH_DENSITY_DISABLE_THRESHOLD = 130;
const AUTO_HIGH_DENSITY_CRITICAL_THRESHOLD = 320;
const AUTO_HIGH_DENSITY_EXTREME_THRESHOLD = 900;
const AUTO_LOW_END_CORE_THRESHOLD = 4;
const PERFORMANCE_MODE_TRANSITION_MS = 280;
const LIVE_MAP_SIMULATION_STEP_MS = 1000;
const LIVE_MAP_SIMULATION_TICK_MS = 1000;
const LIVE_MAP_SIMULATION_LAT_MIN = 45.0;
const LIVE_MAP_SIMULATION_LAT_MAX = 55.0;
const LIVE_MAP_SIMULATION_LNG_MIN = -11.0;
const LIVE_MAP_SIMULATION_LNG_MAX = 26.0;
const LIVE_MAP_SIMULATION_SPEED_MIN = 18;
const LIVE_MAP_SIMULATION_SPEED_MAX = 130;
const LIVE_MAP_SIMULATION_HEADING_STEP_MAX = 18;
const LIVE_MAP_SIMULATION_SPEED_STEP_MAX = 9;
const LIVE_MAP_SIMULATION_NAME_PREFIX = 'LoadProbe';
const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001';

type ClusterDensityProfile = {
  tooltipDensityLimit: number;
  chunkedLoading: boolean;
  chunkInterval: number;
  chunkDelay: number;
  clusterRadiusOffset: number;
  animate: boolean;
  disableClusteringAtZoom: number;
  densityLabel: 'normal' | 'high' | 'critical';
  densityHint: string;
};

type DensityLabel = 'normal' | 'high' | 'critical';

const LIVE_MAP_DENSITY_CALIBRATION = [
  {
    from: 0,
    to: AUTO_HIGH_DENSITY_ENABLE_THRESHOLD - 1,
    label: 'normal',
    hint: 'klein: 0–179 Fahrer',
  },
  {
    from: AUTO_HIGH_DENSITY_ENABLE_THRESHOLD,
    to: AUTO_HIGH_DENSITY_CRITICAL_THRESHOLD - 1,
    label: 'high',
    hint: 'erhöhte Last: 180–319 Fahrer',
  },
  {
    from: AUTO_HIGH_DENSITY_CRITICAL_THRESHOLD,
    to: AUTO_HIGH_DENSITY_EXTREME_THRESHOLD - 1,
    label: 'critical',
    hint: 'kritisch: 320–899 Fahrer (500er-Range getestet)',
  },
  {
    from: AUTO_HIGH_DENSITY_EXTREME_THRESHOLD,
    to: Number.POSITIVE_INFINITY,
    label: 'critical',
    hint: 'sehr kritisch: 900+ Fahrer (1000–3000+ Range)',
  },
] as const;

function getStatusMeta(status: LiveMapStatus): LiveMapStatusMeta {
  return SOCKET_STATUS_META[status];
}

function formatTime(time: number | null): string {
  return time ? new Date(time).toLocaleTimeString('de-DE') : '—';
}

function formatSpeed(value: number): string {
  return `${Math.round(value)} km/h`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hasLowEndDeviceSignals() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const hardwareConcurrency = navigator.hardwareConcurrency ?? 8;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const isSmallViewport = window.matchMedia('(max-width: 900px)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    hardwareConcurrency <= AUTO_LOW_END_CORE_THRESHOLD ||
    (deviceMemory !== undefined && deviceMemory <= 4) ||
    (isSmallViewport && isCoarsePointer) ||
    (prefersReducedMotion && isSmallViewport)
  );
}

function resolveAutoPerformanceMode(driverCount: number, previous: boolean) {
  if (hasLowEndDeviceSignals()) {
    return true;
  }

  if (driverCount >= AUTO_HIGH_DENSITY_CRITICAL_THRESHOLD) {
    return true;
  }

  if (driverCount >= AUTO_HIGH_DENSITY_ENABLE_THRESHOLD) {
    return true;
  }

  if (driverCount <= AUTO_HIGH_DENSITY_DISABLE_THRESHOLD) {
    return false;
  }

  return previous;
}

function resolveDensityLabel(driverCount: number): DensityLabel {
  if (driverCount >= AUTO_HIGH_DENSITY_CRITICAL_THRESHOLD) {
    return 'critical';
  }

  if (driverCount >= AUTO_HIGH_DENSITY_ENABLE_THRESHOLD) {
    return 'high';
  }

  return 'normal';
}

function resolveClusterDensityProfile(driverCount: number, performanceMode: boolean): ClusterDensityProfile {
  const densityLabel = resolveDensityLabel(driverCount);
  const densityHint = LIVE_MAP_DENSITY_CALIBRATION.find((bucket) => driverCount >= bucket.from && driverCount <= bucket.to)?.hint ?? 'unbekannt';

  if (densityLabel === 'critical') {
    if (driverCount >= AUTO_HIGH_DENSITY_EXTREME_THRESHOLD) {
      return {
        tooltipDensityLimit: performanceMode ? 30 : 52,
        chunkedLoading: true,
        chunkInterval: performanceMode ? 240 : 190,
        chunkDelay: 34,
        clusterRadiusOffset: 24,
        animate: false,
        disableClusteringAtZoom: 11,
        densityLabel,
        densityHint,
      };
    }

    return {
      tooltipDensityLimit: performanceMode ? 38 : 76,
      chunkedLoading: true,
      chunkInterval: performanceMode ? 220 : 170,
      chunkDelay: 26,
      clusterRadiusOffset: 18,
      animate: false,
      disableClusteringAtZoom: 12,
      densityLabel,
      densityHint,
    };
  }

  if (densityLabel === 'high') {
    return {
      tooltipDensityLimit: performanceMode ? 56 : 92,
      chunkedLoading: true,
      chunkInterval: performanceMode ? 180 : 140,
      chunkDelay: 22,
      clusterRadiusOffset: performanceMode ? 10 : 6,
      animate: false,
      disableClusteringAtZoom: 13,
      densityLabel,
      densityHint,
    };
  }

  return {
    tooltipDensityLimit: performanceMode ? MAX_TOOLTIP_DENSITY_PERFORMANCE : MAX_TOOLTIP_DENSITY_STANDARD,
    chunkedLoading: performanceMode,
    chunkInterval: 130,
    chunkDelay: performanceMode ? 20 : 30,
    clusterRadiusOffset: 0,
    animate: !performanceMode,
    disableClusteringAtZoom: 14,
    densityLabel,
    densityHint,
  };
}

function getRoomDisplayLabel(roomId: string | null | undefined) {
  if (!roomId) {
    return 'global';
  }

  if (roomId.length > 26) {
    return `${roomId.slice(0, 26)}…`;
  }

  return roomId;
}

function getTrailColor(progress: number) {
  const light = 38 + 42 * progress;
  const alpha = 0.3 + 0.64 * progress;
  return `hsla(46, 84%, ${light}%, ${alpha})`;
}

const createSeededRandom = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
};

const clampToRange = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

function sanitizeText(raw: string | undefined | null, fallback = '—') {
  const value = raw?.trim() ?? '';
  return value.length ? value : fallback;
}

function isPointInside(point: LiveDriverPoint, bounds: L.LatLngBounds | null, padding = 0.22) {
  if (!bounds) {
    return true;
  }

  return bounds.pad(padding).contains([point.latitude, point.longitude]);
}

function decimateTrail(points: LiveDriverPoint[], maxPoints: number, step = STANDARD_TRAIL_DECIMATION_STEP) {
  if (points.length <= maxPoints) {
    return points;
  }

  const sampled = points.filter((_, index) => index % step === 0 || index === points.length - 1);
  if (sampled.length >= 3) {
    return sampled;
  }

  return points;
}

function createDriverTooltipHtml(driver: LiveDriver) {
  return `
    <div class="rounded-md border border-gold-700/35 bg-ink-950/95 px-2 py-1.5 text-xs text-gold-100 min-w-[180px]">
      <p class="font-semibold text-gold-200">${sanitizeText(driver.driverName, 'Fahrer')}</p>
      <p>${formatSpeed(driver.speedKmh)}</p>
      <p>${sanitizeText(driver.cargoName, 'Cargo unbekannt')}</p>
      <p class="text-gold-200/85">${sanitizeText(driver.sourceCity, '—')} → ${sanitizeText(driver.destinationCity, '—')}</p>
      <p class="text-gold-300/80">${formatTime(driver.timestamp)}</p>
    </div>
  `;
}

function createGoldMarker(driver: LiveDriver, isSelected: boolean) {
  const title = sanitizeText(driver.driverName, 'Fahrer');
  const cargo = sanitizeText(driver.cargoName, 'Cargo');

  return L.divIcon({
    className: 'telemetry-marker-root',
    html: `
      <div class="telemetry-marker-shell ${isSelected ? 'telemetry-marker-shell--selected' : ''}">
        <p class="telemetry-marker-title">${title}</p>
        <p class="telemetry-marker-speed">${formatSpeed(driver.speedKmh)}</p>
        <p class="telemetry-marker-cargo">Cargo · ${cargo}</p>
      </div>
    `,
    iconSize: [182, 62],
    iconAnchor: [91, 57],
    popupAnchor: [0, -46],
  });
}

function createGoldClusterMarker(count: number) {
  return L.divIcon({
    className: 'telemetry-cluster-marker',
    html: `
      <div class="telemetry-cluster-shell">
        <span class="telemetry-cluster-count">${count}</span>
        <span class="telemetry-cluster-label">Fahrer</span>
      </div>
    `,
    iconSize: [64, 64],
    iconAnchor: [32, 32],
  });
}

export default function LiveMap({ companyId, simulationDriverCount }: LiveMapProps) {
  const [drivers, setDrivers] = useState<Record<string, LiveDriver>>({});
  const [renderedDrivers, setRenderedDrivers] = useState<LiveDriver[]>([]);
  const [followDriverId, setFollowDriverId] = useState<string | null>(null);
  const [showTrails, setShowTrails] = useState(true);
  const [showAllTrails, setShowAllTrails] = useState(false);
  const [trailWindow, setTrailWindow] = useState(TRAIL_WINDOW_DEFAULT);
  const [performanceMode, setPerformanceMode] = useState(true);
  const [autoPerformanceMode, setAutoPerformanceMode] = useState(true);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [status, setStatus] = useState<LiveMapStatus>('connecting');
  const [statusMessage, setStatusMessage] = useState('Verbinde Live-Daten…');
  const [receivedEvents, setReceivedEvents] = useState(0);
  const [invalidEvents, setInvalidEvents] = useState(0);
  const [lastStreamAt, setLastStreamAt] = useState<number | null>(null);
  const [rejoinEpoch, setRejoinEpoch] = useState(0);
  const [isPerformanceTransitioning, setIsPerformanceTransitioning] = useState(false);

  const normalizedSimulationDriverCount = useMemo(() => {
    const requested = Number(simulationDriverCount);
    if (!Number.isFinite(requested)) {
      return 0;
    }

    const safe = Math.max(0, Math.floor(requested));
    if (safe <= 0) {
      return 0;
    }

    const hasExactMatch = (LIVE_MAP_SIMULATION_SPEED_LIMITS as readonly number[]).includes(safe);
    return hasExactMatch ? safe : 0;
  }, [simulationDriverCount]);
  const isSimulationMode = normalizedSimulationDriverCount > 0;

  const lastStreamAtRef = useRef<number | null>(null);
  const receivedEventsRef = useRef(0);
  const activeDriverCountRef = useRef(0);
  const trailMapRef = useRef<Record<string, LiveDriverPoint[]>>({});
  const simulationStateRef = useRef<Record<string, SimulationState>>({});
  const simulationTimerRef = useRef<number | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);
  const pruneTimerRef = useRef<number | null>(null);
  const rejoinTimerRef = useRef<number | null>(null);
  const renderDebounceTimerRef = useRef<number | null>(null);
  const currentStatusRef = useRef<LiveMapStatus>('connecting');
  const mountedRef = useRef(true);
  const performanceTransitionTimerRef = useRef<number | null>(null);

  const telemetryContext = useMemo(() => createTelemetryContext(companyId), [companyId]);
  const contract = useMemo(() => {
    try {
      return validateTelemetryBackendContract();
    } catch {
      return null;
    }
  }, []);
  const normalizedRoom = useMemo(() => normalizeRoomInputOrFallback(telemetryContext.room), [telemetryContext.room]);

  const setStatusSafe = useCallback((nextStatus: LiveMapStatus, message: string) => {
    if (!mountedRef.current) {
      return;
    }

    currentStatusRef.current = nextStatus;
    setStatus(nextStatus);
    setStatusMessage(message);
  }, []);

  const runPerformanceTransition = useCallback(
    (apply: () => void) => {
      if (performanceTransitionTimerRef.current) {
        clearTimeout(performanceTransitionTimerRef.current);
      }

      setIsPerformanceTransitioning(true);
      apply();

      performanceTransitionTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) {
          setIsPerformanceTransitioning(false);
        }
      }, PERFORMANCE_MODE_TRANSITION_MS);
    },
    [mountedRef, setIsPerformanceTransitioning],
  );

  const setAutoPerfMode = useCallback(
    (enabled: boolean, renderedCount = renderedDrivers.length) => {
      if (!mountedRef.current) {
        return;
      }

      runPerformanceTransition(() => {
        setAutoPerformanceMode(enabled);
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(LIVE_MAP_PERFORMANCE_MODE_AUTO_KEY, enabled ? '1' : '0');
            if (!enabled) {
              window.localStorage.setItem(LIVE_MAP_PERFORMANCE_MODE_KEY, performanceMode ? 'performance' : 'quality');
            }
          }
        } catch {
          // ignore quota/storage errors
        }

        if (enabled) {
          setPerformanceMode((prev) => resolveAutoPerformanceMode(renderedCount, prev));
        }
      });
    },
    [performanceMode, renderedDrivers.length, runPerformanceTransition],
  );

  const setManualPerfMode = useCallback((nextMode: boolean) => {
    runPerformanceTransition(() => {
      setAutoPerformanceMode(false);
      setPerformanceMode(nextMode);
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(LIVE_MAP_PERFORMANCE_MODE_AUTO_KEY, '0');
          window.localStorage.setItem(LIVE_MAP_PERFORMANCE_MODE_KEY, nextMode ? 'performance' : 'quality');
        }
      } catch {
        // ignore storage failures
      }
    });
  }, [runPerformanceTransition]);

  const scheduleRejoin = useCallback(() => {
    if (rejoinTimerRef.current) {
      clearTimeout(rejoinTimerRef.current);
    }

    rejoinTimerRef.current = window.setTimeout(() => {
      setStatusSafe('reconnecting', 'Session/Kontext geändert. Rejoin startet…');
      setRejoinEpoch((value) => value + 1);
    }, REJOIN_DEBOUNCE_MS);
  }, [setStatusSafe]);

  const markConnected = useCallback(() => {
    setStatusSafe('connected', 'Live-Verbindung aktiv');
  }, [setStatusSafe]);

  const markStreamConnectedIfNeeded = useCallback(() => {
    const hasNoData = lastStreamAtRef.current === null && activeDriverCountRef.current === 0;
    if (hasNoData) {
      setStatusSafe('empty', 'Warte auf Streamdaten');
    }
  }, [setStatusSafe]);

  const pruneTrailData = useCallback((at: number) => {
    const trailCutoff = at - TRAIL_MAX_AGE_MS;
    let mutated = false;
    const driverIds = Object.keys(trailMapRef.current);

    for (const driverId of driverIds) {
      const cleaned = (trailMapRef.current[driverId] ?? [])
        .filter((point) => point.at >= trailCutoff)
        .slice(-TRAIL_MAX_POINTS);

      if (cleaned.length === 0) {
        delete trailMapRef.current[driverId];
        mutated = true;
      } else if ((trailMapRef.current[driverId]?.length ?? 0) !== cleaned.length) {
        trailMapRef.current[driverId] = cleaned;
        mutated = true;
      }
    }

    return mutated;
  }, []);

  const appendTrailPoint = useCallback((driverId: string, latitude: number, longitude: number, at: number) => {
    const current = trailMapRef.current[driverId] ?? [];
    const cutoff = at - TRAIL_MAX_AGE_MS;
    trailMapRef.current[driverId] = [...current, { latitude, longitude, at }]
      .filter((point) => point.at >= cutoff)
      .slice(-TRAIL_MAX_POINTS);
  }, []);

  const stopSimulation = useCallback(() => {
    if (simulationTimerRef.current) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
    simulationStateRef.current = {};
  }, []);

  const ingestTelemetry = useCallback(
    (normalized: TelemetryEventDto, at: number) => {
      appendTrailPoint(normalized.driverId, normalized.latitude, normalized.longitude, at);

      lastStreamAtRef.current = at;
      receivedEventsRef.current += 1;
      setLastStreamAt(at);
      setReceivedEvents((value) => value + 1);

      setDrivers((prev) => {
        const next = {
          ...prev,
          [normalized.driverId]: {
            ...normalized,
            lastSeenAt: at,
          },
        };
        activeDriverCountRef.current = Object.keys(next).length;
        return next;
      });

      setStatusSafe('connected', 'Live-Verbindung aktiv');
    },
    [appendTrailPoint, setStatusSafe],
  );

  useEffect(() => {
    mountedRef.current = true;

    if (isSimulationMode) {
      stopSimulation();
    }

    setDrivers({});
    activeDriverCountRef.current = 0;
    setFollowDriverId(null);
    setReceivedEvents(0);
    setInvalidEvents(0);
    setStatusSafe('connecting', `Verbinde ${getRoomDisplayLabel(normalizedRoom)}`);
    setLastStreamAt(null);
    lastStreamAtRef.current = null;
    receivedEventsRef.current = 0;
    trailMapRef.current = {};
    setRenderedDrivers([]);

    return () => {
      mountedRef.current = false;
      if (performanceTransitionTimerRef.current) {
        clearTimeout(performanceTransitionTimerRef.current);
      }
    };
  }, [normalizedRoom, setStatusSafe, isSimulationMode, stopSimulation]);

  useEffect(() => {
    setRejoinEpoch((value) => value + 1);
  }, [normalizedRoom]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const savedAuto = window.localStorage.getItem(LIVE_MAP_PERFORMANCE_MODE_AUTO_KEY);
    const autoEnabled = savedAuto === null ? true : savedAuto !== '0';
    const savedMode = window.localStorage.getItem(LIVE_MAP_PERFORMANCE_MODE_KEY);
    const shouldUsePerformance = resolveAutoPerformanceMode(0, hasLowEndDeviceSignals());

    setAutoPerformanceMode(autoEnabled);
    if (autoEnabled) {
      setPerformanceMode(shouldUsePerformance);
    } else if (savedMode === 'performance' || savedMode === 'quality') {
      setPerformanceMode(savedMode === 'performance');
    }
  }, []);

  useEffect(() => {
    if (!autoPerformanceMode) {
      return;
    }

    setPerformanceMode((prev) => resolveAutoPerformanceMode(renderedDrivers.length, prev));
  }, [autoPerformanceMode, renderedDrivers.length]);

  useEffect(() => {
    const sorted = Object.values(drivers).sort((a, b) => b.lastSeenAt - a.lastSeenAt);

    if (renderDebounceTimerRef.current) {
      clearTimeout(renderDebounceTimerRef.current);
    }

    renderDebounceTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }

      setRenderedDrivers(sorted);
    }, MAP_RENDER_DEBOUNCE_MS);

    return () => {
      if (renderDebounceTimerRef.current) {
        clearTimeout(renderDebounceTimerRef.current);
      }
    };
  }, [drivers]);

  useEffect(() => {
    if (!isSimulationMode || typeof window === 'undefined') {
      stopSimulation();
      return;
    }

    const targetCount = normalizedSimulationDriverCount;
    if (targetCount <= 0) {
      return;
    }

    const rng = createSeededRandom(13_371_000 + targetCount);
    const rangeLat = LIVE_MAP_SIMULATION_LAT_MAX - LIVE_MAP_SIMULATION_LAT_MIN;
    const rangeLng = LIVE_MAP_SIMULATION_LNG_MAX - LIVE_MAP_SIMULATION_LNG_MIN;

    const driversPayload: Record<string, LiveDriver> = {};
    const now = Date.now();

    for (let index = 0; index < targetCount; index += 1) {
      const driverId = `${LIVE_MAP_SIMULATION_NAME_PREFIX}-${String(index + 1).padStart(5, '0')}`;
      const baseHeading = rng() * 360;
      const payload: SimulationState = {
        latitude: LIVE_MAP_SIMULATION_LAT_MIN + rng() * rangeLat,
        longitude: LIVE_MAP_SIMULATION_LNG_MIN + rng() * rangeLng,
        speedKmh: clampToRange(
          LIVE_MAP_SIMULATION_SPEED_MIN + rng() * (LIVE_MAP_SIMULATION_SPEED_MAX - LIVE_MAP_SIMULATION_SPEED_MIN),
          LIVE_MAP_SIMULATION_SPEED_MIN,
          LIVE_MAP_SIMULATION_SPEED_MAX,
        ),
        heading: baseHeading,
        driverName: `LoadProbe ${String(index + 1).padStart(5, '0')}`,
        cargoName: `Probe-Ladung ${index % 7}`,
        sourceCity: 'München',
        destinationCity: 'Hamburg',
        truckModel: 'Probe-Truck',
      };

      simulationStateRef.current[driverId] = payload;
      driversPayload[driverId] = {
        driverId,
        driverName: payload.driverName,
        speedKmh: payload.speedKmh,
        latitude: payload.latitude,
        longitude: payload.longitude,
        cargoName: payload.cargoName,
        sourceCity: payload.sourceCity,
        destinationCity: payload.destinationCity,
        truckModel: payload.truckModel,
        timestamp: now,
        lastSeenAt: now,
      };
      trailMapRef.current[driverId] = [{ latitude: payload.latitude, longitude: payload.longitude, at: now }];
    }

    setStatusSafe('connected', `Load-Probe aktiv · ${targetCount} simulierte Fahrer`);
    setReceivedEvents(0);
    setInvalidEvents(0);
    setLastStreamAt(now);
    lastStreamAtRef.current = now;
    receivedEventsRef.current = 0;
    activeDriverCountRef.current = targetCount;
    setDrivers(driversPayload);
    setRenderedDrivers(Object.values(driversPayload));

    const tick = () => {
      const current = Date.now();
      const nextDrivers: Record<string, LiveDriver> = {};

      const ids = Object.keys(simulationStateRef.current);

      for (const driverId of ids) {
        const state = simulationStateRef.current[driverId];
        const headingDelta = (rng() - 0.5) * LIVE_MAP_SIMULATION_HEADING_STEP_MAX;
        const speedDelta = (rng() - 0.5) * LIVE_MAP_SIMULATION_SPEED_STEP_MAX;

        state.heading = (state.heading + headingDelta + 360) % 360;
        state.speedKmh = clampToRange(state.speedKmh + speedDelta, LIVE_MAP_SIMULATION_SPEED_MIN, LIVE_MAP_SIMULATION_SPEED_MAX);

        const metersPerSecond = state.speedKmh / 3.6;
        const stepSeconds = LIVE_MAP_SIMULATION_STEP_MS / 1000;
        const delta = metersPerSecond * stepSeconds;
        const headingInRad = (state.heading * Math.PI) / 180;
        let latitude = state.latitude + (delta / 111_320) * Math.sin(headingInRad);
        let longitude = state.longitude + (delta / (111_320 * Math.cos((state.latitude * Math.PI) / 180))) * Math.cos(headingInRad);

        if (latitude < LIVE_MAP_SIMULATION_LAT_MIN || latitude > LIVE_MAP_SIMULATION_LAT_MAX) {
          state.heading = (180 - state.heading + 360) % 360;
          latitude = clampToRange(latitude, LIVE_MAP_SIMULATION_LAT_MIN, LIVE_MAP_SIMULATION_LAT_MAX);
        }

        if (longitude < LIVE_MAP_SIMULATION_LNG_MIN || longitude > LIVE_MAP_SIMULATION_LNG_MAX) {
          state.heading = (360 - state.heading + 360) % 360;
          longitude = clampToRange(longitude, LIVE_MAP_SIMULATION_LNG_MIN, LIVE_MAP_SIMULATION_LNG_MAX);
        }

        state.latitude = latitude;
        state.longitude = longitude;

        appendTrailPoint(driverId, latitude, longitude, current);

        nextDrivers[driverId] = {
          driverId,
          driverName: state.driverName,
          speedKmh: state.speedKmh,
          latitude,
          longitude,
          cargoName: state.cargoName,
          sourceCity: state.sourceCity,
          destinationCity: state.destinationCity,
          truckModel: state.truckModel,
          timestamp: current,
          lastSeenAt: current,
        };
      }

      receivedEventsRef.current += ids.length;
      setReceivedEvents((value) => value + ids.length);
      lastStreamAtRef.current = current;
      setLastStreamAt(current);
      setDrivers(() => nextDrivers);
      setRenderedDrivers(Object.values(nextDrivers));
      activeDriverCountRef.current = ids.length;
    };

    simulationTimerRef.current = window.setInterval(tick, LIVE_MAP_SIMULATION_TICK_MS);
    return () => stopSimulation();
  }, [isSimulationMode, normalizedSimulationDriverCount, stopSimulation, setStatusSafe, appendTrailPoint]);
  useEffect(() => {
    if (isSimulationMode) {
      return;
    }

    const selector = telemetryContext.companyId
      ? { companyId: telemetryContext.companyId }
      : { room: normalizedRoom ?? telemetryContext.room };

    const socket = createTelemetrySocket({
      namespace: TELEMETRY_BACKEND_CONTRACT.namespace,
      autoConnect: false,
      baseUrl: SOCKET_URL,
      companyId: selector.companyId,
      room: selector.room,
    });

    const enforceStatusAfterConnect = () => {
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }

      cleanupTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) {
          return;
        }
        markStreamConnectedIfNeeded();
      }, SOCKET_READY_TIMEOUT_MS);
    };

    const onConnect = () => {
      markConnected();
      emitJoinRoom(socket, selector);
      setLastStreamAt(null);
      lastStreamAtRef.current = null;
      enforceStatusAfterConnect();
    };

    const onDisconnect = (reason: string) => {
      setStatusSafe('disconnected', `Verbindung getrennt (${reason})`);
    };

    const onReconnectAttempt = () => {
      setStatusSafe('reconnecting', 'Verbindung wird wiederhergestellt');
    };

    const onError = (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Verbindungsfehler';
      setStatusSafe('error', message);
    };

    const onStream = (payload: unknown) => {
      const normalized = parseTelemetryPayload(payload);
      if (!normalized) {
        setInvalidEvents((value) => value + 1);
        return;
      }

      ingestTelemetry(normalized, Date.now());
    };

    const onReconnect = () => {
      setStatusSafe('reconnecting', 'Raum erneut joinen…');
      emitJoinRoom(socket, selector);
      markConnected();
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('reconnect', onReconnect);
    socket.on('connect_error', onError);
    (socket as any).on(TELEMETRY_EVENTS.TELEMETRY_STREAM, onStream);

    socket.connect();

    pruneTimerRef.current = window.setInterval(() => {
      const cutoff = Date.now() - MAX_DRIVER_STALE_MS;
      const now = Date.now();

      setDrivers((prev) => {
        const next: Record<string, LiveDriver> = {};
        for (const [id, item] of Object.entries(prev)) {
          if (item.lastSeenAt >= cutoff) {
            next[id] = item;
          }
        }

        const nextCount = Object.keys(next).length;
        activeDriverCountRef.current = nextCount;

        if (nextCount === 0 && lastStreamAtRef.current === null && currentStatusRef.current === 'connected') {
          setStatusSafe('empty', 'Warte auf Streamdaten');
        }

        return next;
      });

      const didPruneTrail = pruneTrailData(now);
      if (didPruneTrail && mountedRef.current) {
        setRenderedDrivers((prev) => [...prev]);
      }
    }, CLEANUP_INTERVAL_MS);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect', onReconnect);
      socket.off('connect_error', onError);
      (socket as any).off(TELEMETRY_EVENTS.TELEMETRY_STREAM, onStream);
      socket.disconnect();

      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }

      if (pruneTimerRef.current) {
        clearInterval(pruneTimerRef.current);
      }
    };
  }, [isSimulationMode, stopSimulation, rejoinEpoch, setStatusSafe, markConnected, markStreamConnectedIfNeeded, normalizedRoom, telemetryContext.companyId, ingestTelemetry, pruneTrailData]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'vtc_active_company_id') {
        scheduleRejoin();
      }
    };

    const onCompanyChanged = () => scheduleRejoin();
    const onAuthChanged = () => scheduleRejoin();
    const onAuthExpired = () => scheduleRejoin();
    const onVisibilityChange = () => {
      if (!document.hidden) {
        scheduleRejoin();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('vtc:company-changed', onCompanyChanged);
    window.addEventListener('vtc:auth-changed', onAuthChanged);
    window.addEventListener('vtc:auth-expired', onAuthExpired);
    window.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('vtc:company-changed', onCompanyChanged);
      window.removeEventListener('vtc:auth-changed', onAuthChanged);
      window.removeEventListener('vtc:auth-expired', onAuthExpired);
      window.removeEventListener('visibilitychange', onVisibilityChange);
      if (rejoinTimerRef.current) {
        clearTimeout(rejoinTimerRef.current);
      }
    };
  }, [scheduleRejoin]);

  useEffect(() => {
    if (!followDriverId) {
      return;
    }

    if (!drivers[followDriverId]) {
      setFollowDriverId(null);
    }
  }, [followDriverId, drivers]);

  const hasBounds = Boolean(mapBounds);
  const driverDensityProfile = useMemo(
    () => resolveClusterDensityProfile(renderedDrivers.length, performanceMode),
    [performanceMode, renderedDrivers.length],
  );
  const inViewportDrivers = useMemo(() => {
    if (!mapBounds) {
      return renderedDrivers;
    }

    const padded = mapBounds.pad(VIEWPORT_PADDING);
    const list = renderedDrivers.filter((driver) => {
      if (!Number.isFinite(driver.latitude) || !Number.isFinite(driver.longitude)) {
        return false;
      }
      return padded.contains([driver.latitude, driver.longitude]);
    });

    if (followDriverId && drivers[followDriverId] && !list.some((driver) => driver.driverId === followDriverId)) {
      list.push(drivers[followDriverId]);
    }

    if (list.length === 0 && renderedDrivers.length > 0) {
      return renderedDrivers.slice(0, 120);
    }

    return list;
  }, [renderedDrivers, mapBounds, followDriverId, drivers]);

  const selectedDriver = followDriverId ? drivers[followDriverId] : undefined;
  const hasDrivers = renderedDrivers.length > 0;
  const hasViewportDrivers = inViewportDrivers.length > 0;
  const visibleDriverCount = inViewportDrivers.length;
  const densityLevelLabel = driverDensityProfile.densityLabel;
  const densityHint = driverDensityProfile.densityHint;
  const tooltipDensityLimit = driverDensityProfile.tooltipDensityLimit;
  const maxTrailRenderOffscreen = performanceMode ? PERFORMANCE_TRAIL_RENDER_OFFSCREEN : MAX_TRAIL_RENDER_OFFSCREEN;
  const trailDecimationStep = performanceMode ? PERFORMANCE_TRAIL_DECIMATION_STEP : STANDARD_TRAIL_DECIMATION_STEP;
  const maxStatusItems = Math.max(
    performanceMode ? MAX_LIST_ITEMS_PERF : MAX_LIST_ITEMS,
    driverDensityProfile.tooltipDensityLimit,
  );
  const defaultTrailDisplayLimit = performanceMode ? 1 : 2;
  const activeTrailWindow = useMemo(
    () => clampNumber(trailWindow, TRAIL_WINDOW_MIN, TRAIL_WINDOW_MAX),
    [trailWindow],
  );
  const activeStatusDrivers = useMemo(() => {
    const source = hasViewportDrivers ? inViewportDrivers : renderedDrivers;

    if (source.length <= maxStatusItems) {
      return source;
    }

    return source.slice(0, maxStatusItems);
  }, [hasViewportDrivers, inViewportDrivers, maxStatusItems, renderedDrivers]);

  const visibleDriverIds = useMemo(() => new Set(activeStatusDrivers.map((driver) => driver.driverId)), [activeStatusDrivers]);

  const resolveTrailPoints = useCallback(
    (driverId: string) => {
      const points = trailMapRef.current[driverId] ?? [];
      const clamped = points.slice(-activeTrailWindow);

      if (clamped.length < 2) {
        return clamped;
      }

      const isFollowed = followDriverId === driverId;
      if (!mapBounds || isFollowed) {
        return clamped;
      }

      const lastPoint = clamped[clamped.length - 1];
      const isVisibleByTrail = isPointInside(lastPoint, mapBounds, TRAIL_VIEWPORT_PADDING);
      const isDriverInActiveList = visibleDriverIds.has(driverId);

      if (!isVisibleByTrail && !isDriverInActiveList) {
        return [];
      }

      if (clamped.length > maxTrailRenderOffscreen) {
        return decimateTrail(clamped, maxTrailRenderOffscreen, trailDecimationStep);
      }

      return clamped;
    },
    [activeTrailWindow, followDriverId, maxTrailRenderOffscreen, mapBounds, trailDecimationStep, visibleDriverIds],
  );

  const trailIds = useMemo(() => {
    if (!showTrails) {
      return [];
    }

    if (followDriverId && drivers[followDriverId]) {
      return [followDriverId];
    }

    const ids = activeStatusDrivers.map((driver) => driver.driverId);
    return showAllTrails ? ids : ids.slice(0, defaultTrailDisplayLimit);
  }, [activeStatusDrivers, defaultTrailDisplayLimit, followDriverId, showAllTrails, showTrails, drivers]);

  const effectiveStatus =
    status === 'connected' && hasDrivers ? 'connected' : status === 'connected' && !hasDrivers && !lastStreamAt ? 'empty' : status;
  const statusMeta = getStatusMeta(effectiveStatus);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="space-y-3 overflow-hidden rounded-3xl border border-ink-700/70 bg-ink-900/70 p-2 shadow-glass">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-700/60 bg-ink-950/65 p-3">
          <p className="text-xs uppercase tracking-[0.24em] text-gold-300/85">Stream-Status</p>
          <div className="flex items-center gap-2 rounded-full border border-ink-600/75 bg-ink-950 px-3 py-1 text-xs">
            <span className={`inline-block h-2 w-2 rounded-full ${statusMeta.badgeClass}`} />
            <span className={`${statusMeta.colorClass} font-medium`}>{statusMeta.text}</span>
          </div>
        </div>

        <div className="mb-2 rounded-xl border border-gold-700/40 bg-ink-950/75 px-3 py-2 text-sm text-gold-200/90">
          <p className="font-medium text-gold-100">Raum: {getRoomDisplayLabel(normalizedRoom ?? telemetryContext.room)}</p>
          <p className="mt-1 text-xs text-gold-300">{statusMessage}</p>
        </div>

        {isSimulationMode ? (
          <div className="mb-2 rounded-xl border border-gold-500/65 bg-gold-500/10 px-3 py-2 text-xs text-gold-100/95">
            <p className="font-semibold text-gold-200">Load-Probe aktiv</p>
            <p className="mt-1 text-gold-100/85">
              {normalizedSimulationDriverCount} simulierte Fahrer · {formatTime(lastStreamAt)} · Trails: {showTrails ? 'an' : 'aus'}
            </p>
          </div>
        ) : null}

        <div className="mb-2 rounded-xl border border-ink-700/55 bg-ink-950/65 p-2 text-xs text-gold-200/90">
          <p>
            <span className="text-gold-100">Kontrakt:</span> {contract?.namespace}/{contract?.streamEvent}
            {' · '}join_room + join_company_room
          </p>
          <p className="mt-1 text-gold-300">
            Last packet: {formatTime(lastStreamAt)} · valid: {receivedEvents} · invalid: {invalidEvents}
          </p>
        </div>

          <div
            className={`mb-2 grid gap-2 rounded-xl border border-ink-700/60 bg-ink-950/65 p-3 transition-all duration-300 ${
              isPerformanceTransitioning ? 'scale-[0.998] opacity-90' : 'scale-100 opacity-100'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTrails((value) => !value)}
                disabled={isPerformanceTransitioning}
                className="rounded-full border border-gold-600/55 bg-gold-700/15 px-3 py-1.5 text-xs text-gold-100 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gold-500/20"
            >
              Trails {showTrails ? 'aus' : 'an'}
            </button>
            <button
              type="button"
              onClick={() => setShowAllTrails((value) => !value)}
              disabled={isPerformanceTransitioning || !showTrails}
              className="rounded-full border border-gold-600/55 bg-gold-700/15 px-3 py-1.5 text-xs text-gold-100 transition hover:bg-gold-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {showAllTrails ? 'Nur Top-2 Trails' : 'Alle Trails'}
            </button>
              <button
                type="button"
                onClick={scheduleRejoin}
                disabled={isPerformanceTransitioning}
                className="rounded-full border border-gold-600/45 bg-gold-700/15 px-3 py-1.5 text-xs text-gold-100 transition hover:bg-gold-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Neu joinen
              </button>
            </div>

            <label className="flex items-start gap-2 rounded-xl border border-ink-700/55 bg-ink-950/70 px-3 py-2 text-xs text-gold-200/90">
              <input
                type="checkbox"
                checked={autoPerformanceMode}
                onChange={(event) => setAutoPerfMode(event.currentTarget.checked)}
                disabled={isPerformanceTransitioning}
                className="mt-0.5 h-4 w-4 accent-gold-300 focus:ring-0"
              />
              <span>
                <span className="font-semibold text-gold-100">Auto-Performance-Modus</span>
                {' · '}
                <span className="text-gold-300/90">
                  {autoPerformanceMode ? 'aktiv (Gerät + Last)' : 'deaktiviert'}
                  {isPerformanceTransitioning ? ' · wird optimiert…' : ''}
                </span>
              </span>
            </label>

            <label className={`flex items-start gap-2 rounded-xl border border-ink-700/55 bg-ink-950/70 px-3 py-2 text-xs text-gold-200/90 ${autoPerformanceMode ? 'opacity-70' : ''}`}>
              <input
                type="checkbox"
                checked={performanceMode}
                disabled={autoPerformanceMode || isPerformanceTransitioning}
                onChange={(event) => setManualPerfMode(event.currentTarget.checked)}
                className="mt-0.5 h-4 w-4 accent-gold-300 focus:ring-0"
              />
              <span>
                <span className="font-semibold text-gold-100">Performancemodus (manuell)</span>
                {' · '}
                <span className="text-gold-300/90">
                  {performanceMode ? 'Marker/Trails reduzieren' : 'Volle Detailtiefe'}
                </span>
              </span>
            </label>

            <label className="space-y-2">
              <p className="flex items-center justify-between text-xs text-gold-200/95">
                <span>Trail Länge (letzte Punkte)</span>
              <span className="font-semibold text-gold-100">{activeTrailWindow} Punkte</span>
            </p>
            <input
              type="range"
              min={TRAIL_WINDOW_MIN}
              max={TRAIL_WINDOW_MAX}
              value={activeTrailWindow}
              disabled={!showTrails || isPerformanceTransitioning}
              onChange={(event) => setTrailWindow(Number(event.currentTarget.value))}
              className="telemetry-trail-range"
            />
          </label>

          <p className="text-[11px] text-gold-300/80">
            Viewport: {hasBounds ? 'aktiv' : 'initialisiert'} · Gerenderte Marker: {inViewportDrivers.length} (degressiv reduziert) ·
            Tooltips-Eager ab: {tooltipDensityLimit} · {autoPerformanceMode ? 'automatisch' : 'manuell'} · Dichte: {densityLevelLabel} ({densityHint})
          </p>
          {isPerformanceTransitioning ? (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-gold-200/85">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-300" />
              Live-Performancemodus wird feinjustiert …
            </p>
          ) : null}
        </div>

        {effectiveStatus === 'empty' ? (
          <div className="rounded-xl border border-gold-700/45 bg-ink-950/70 p-3 text-sm text-gold-100">
            <p className="font-medium">Warte auf Live-Stream</p>
            <p className="mt-1 text-xs text-gold-200/85">
              Die Verbindung steht, aber aktuell kommen noch keine Telemetrie-Payloads an. Karte bleibt in Wartezustand.
            </p>
          </div>
        ) : null}

        {effectiveStatus === 'error' ? (
          <div className="rounded-xl border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-100">
            Live-Verbindung fehlgeschlagen. Prüfe Token/Session und Namespace/Events im Backend.
          </div>
        ) : null}

        <MapContainer
          center={EUROPE_CENTER}
          zoom={6}
          preferCanvas
          className="h-[56vh] w-full rounded-2xl md:h-[60vh] lg:h-[68vh]"
          scrollWheelZoom
          attributionControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains={['a', 'b', 'c', 'd']}
          />

          <MapUpdater
            followDriverId={followDriverId}
            followLat={selectedDriver?.latitude}
            followLng={selectedDriver?.longitude}
          />

          <MapBoundsMonitor onBoundsChange={setMapBounds} />

          <ClusteredDriverLayer
            drivers={activeStatusDrivers}
            selectedDriverId={followDriverId}
            performanceMode={performanceMode}
            onSelectDriver={(driverId) => setFollowDriverId(driverId)}
          />

          {trailIds.map((driverId, index) => {
            const clamped = resolveTrailPoints(driverId);

            if (clamped.length < 2) {
              return null;
            }

            return clamped.slice(1).map((point, segmentIndex) => {
              const prev = clamped[segmentIndex];
              const progress = (segmentIndex + 1) / (clamped.length - 1);
              const hueColor = getTrailColor(progress);

              return (
                <Polyline
                  key={`trail-${driverId}-${segmentIndex}`}
                  positions={[
                    [prev.latitude, prev.longitude],
                    [point.latitude, point.longitude],
                  ]}
                  pathOptions={{
                    color: hueColor,
                    weight: index % 2 === 0 ? 3.4 : 3,
                    opacity: 0.95,
                    dashArray: progress > 0.82 ? '2 8' : '5 7',
                    lineCap: 'round',
                  }}
                />
              );
            });
          })}
        </MapContainer>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gold-300/80">
            {hasDrivers ? `${renderedDrivers.length} Fahrer aktiv` : 'Stream inaktiv'} · Last: {formatTime(lastStreamAt)}
          </p>
        </div>
      </section>

      <aside className="rounded-3xl border border-ink-700/70 bg-ink-900/70 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-gold-100">Aktive Fahrer</h3>
          <span className="rounded-full border border-gold-700/45 px-2.5 py-1 text-[11px] text-gold-200">
            {hasDrivers ? `${visibleDriverCount} im Viewport` : '0 aktiv'}
          </span>
        </div>

        {!hasDrivers ? (
          <div className="rounded-xl border border-gold-700/40 bg-ink-950/60 p-4 text-sm text-gold-200/85">
            <p className="font-medium text-gold-100">Noch keine aktiven Fahrer im Raum.</p>
            <p className="mt-2 text-xs text-gold-300/85">
              Sobald Telemetrie-Payloads ankommen, siehst du direkt Marker, Tooltips und Live-Infos in der Karte.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {activeStatusDrivers.map((driver) => {
              const isSelected = followDriverId === driver.driverId;

              return (
                <li key={driver.driverId}>
                  <button
                    type="button"
                    onClick={() => setFollowDriverId(driver.driverId)}
                    className={`interactive-focus min-h-11 w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                      isSelected
                        ? 'border-gold-400/70 bg-gold-500/15 text-gold-100'
                        : 'border-ink-600 bg-ink-950/60 text-gold-200/90 hover:bg-ink-900/80'
                    }`}
                  >
                    <p className="truncate font-semibold">{sanitizeText(driver.driverName, 'Fahrer')}</p>
                    <p className="mt-0.5 text-[11px] text-gold-200/85">
                      {formatSpeed(driver.speedKmh)} · {driver.latitude.toFixed(4)}, {driver.longitude.toFixed(4)}
                    </p>
                    <p className="mt-1 text-gold-300/85">{sanitizeText(driver.truckModel, 'Truck unbekannt')}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {followDriverId ? (
          <button
            type="button"
            onClick={() => setFollowDriverId(null)}
            className="interactive-focus mt-3 inline-flex min-h-11 w-full justify-center rounded-lg border border-gold-500/40 bg-gold-500/10 px-4 py-2 text-sm font-semibold text-gold-100"
          >
            Kamera-Tracking beenden
          </button>
        ) : null}
      </aside>
    </div>
  );
}
