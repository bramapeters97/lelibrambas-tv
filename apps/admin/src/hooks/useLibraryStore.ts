import { useCallback, useEffect, useState } from 'react';
import { createDemoSnapshot } from '../data/demo';
import { loadStoredSnapshot, STORAGE_KEY } from '../lib/library';
import type {
  AdminSettings,
  DeviceRecord,
  DvdCandidate,
  HomeRail,
  ImportJob,
  LibrarySnapshot,
  VideoRecord,
} from '../types';

const hasWindow = typeof window !== 'undefined';

export interface LibraryActions {
  updateVideo: (videoId: string, patch: Partial<VideoRecord>) => void;
  replaceVideos: (videos: VideoRecord[]) => void;
  replaceSnapshot: (snapshot: LibrarySnapshot) => void;
  addMockSources: (names: string[], sourceKind: ImportJob['sourceKind']) => void;
  updateJob: (jobId: string, patch: Partial<ImportJob>) => void;
  toggleDvdCandidate: (jobId: string, candidateId: string) => void;
  startSelectedDvdConversion: (jobId: string) => void;
  retryJob: (jobId: string) => void;
  createUploadJob: (jobId: string) => void;
  updateDevice: (deviceId: string, patch: Partial<DeviceRecord>) => void;
  updateRail: (railId: string, patch: Partial<HomeRail>) => void;
  moveRail: (railId: string, direction: -1 | 1) => void;
  updateSettings: (patch: Partial<AdminSettings>) => void;
  resetDemo: () => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function useLibraryStore(): [LibrarySnapshot, LibraryActions] {
  const [snapshot, setSnapshot] = useState<LibrarySnapshot>(() => {
    if (!hasWindow) return createDemoSnapshot();
    return loadStoredSnapshot(window.localStorage);
  });

  useEffect(() => {
    if (!hasWindow) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [snapshot]);

  const updateVideo = useCallback((videoId: string, patch: Partial<VideoRecord>) => {
    setSnapshot((current) => ({
      ...current,
      videos: current.videos.map((video) =>
        video.id === videoId ? { ...video, ...patch } : video,
      ),
    }));
  }, []);

  const replaceVideos = useCallback((videos: VideoRecord[]) => {
    setSnapshot((current) => ({ ...current, videos }));
  }, []);

  const replaceSnapshot = useCallback((nextSnapshot: LibrarySnapshot) => {
    setSnapshot(structuredClone(nextSnapshot));
  }, []);

  const addMockSources = useCallback((names: string[], sourceKind: ImportJob['sourceKind']) => {
    setSnapshot((current) => {
      const detectedAt = nowIso();
      const addedJobs: ImportJob[] = names.map((name, index) => ({
        id: `local-${Date.now()}-${index}`,
        displayName: name,
        sourceReference: `Selected locally/${name}`,
        sourceKind,
        status: 'review',
        progress: 100,
        filesFound: sourceKind === 'folder' ? 8 + index : 1,
        sourceSizeBytes: 644_000_000 + index * 210_000_000,
        outputSizeBytes: 0,
        detectedAt,
        updatedAt: detectedAt,
        preset: 'Automatic · review before conversion',
        etaMinutes: null,
        error: null,
        duplicateOf: null,
        requiresHydration: false,
        candidates: [],
        log: ['Local demo scan completed', 'Source remains read-only', 'Awaiting metadata review'],
      }));
      return { ...current, jobs: [...addedJobs, ...current.jobs] };
    });
  }, []);

  const updateJob = useCallback((jobId: string, patch: Partial<ImportJob>) => {
    setSnapshot((current) => ({
      ...current,
      jobs: current.jobs.map((job) =>
        job.id === jobId ? { ...job, ...patch, updatedAt: nowIso() } : job,
      ),
    }));
  }, []);

  const toggleDvdCandidate = useCallback((jobId: string, candidateId: string) => {
    setSnapshot((current) => ({
      ...current,
      jobs: current.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              candidates: job.candidates.map(
                (candidate): DvdCandidate =>
                  candidate.id === candidateId
                    ? { ...candidate, selected: !candidate.selected }
                    : candidate,
              ),
            }
          : job,
      ),
    }));
  }, []);

  const startSelectedDvdConversion = useCallback((jobId: string) => {
    setSnapshot((current) => ({
      ...current,
      jobs: current.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: 'queued',
              progress: 0,
              updatedAt: nowIso(),
              log: [
                ...job.log,
                `${job.candidates.filter((candidate) => candidate.selected).length} title candidates queued safely`,
              ],
            }
          : job,
      ),
    }));
  }, []);

  const retryJob = useCallback((jobId: string) => {
    setSnapshot((current) => ({
      ...current,
      jobs: current.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: 'queued',
              progress: 0,
              error: null,
              requiresHydration: false,
              updatedAt: nowIso(),
              log: [...job.log, 'Retry added to the local queue'],
            }
          : job,
      ),
    }));
  }, []);

  const createUploadJob = useCallback((jobId: string) => {
    setSnapshot((current) => ({
      ...current,
      jobs: current.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: 'uploaded',
              updatedAt: nowIso(),
              log: [
                ...job.log,
                'Demo Cloudflare upload job generated locally',
                'No network request was made',
              ],
            }
          : job,
      ),
    }));
  }, []);

  const updateDevice = useCallback((deviceId: string, patch: Partial<DeviceRecord>) => {
    setSnapshot((current) => ({
      ...current,
      devices: current.devices.map((device) =>
        device.id === deviceId ? { ...device, ...patch } : device,
      ),
    }));
  }, []);

  const updateRail = useCallback((railId: string, patch: Partial<HomeRail>) => {
    setSnapshot((current) => ({
      ...current,
      rails: current.rails.map((rail) => (rail.id === railId ? { ...rail, ...patch } : rail)),
    }));
  }, []);

  const moveRail = useCallback((railId: string, direction: -1 | 1) => {
    setSnapshot((current) => {
      const index = current.rails.findIndex((rail) => rail.id === railId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.rails.length) return current;
      const rails = [...current.rails];
      const currentRail = rails[index];
      const targetRail = rails[targetIndex];
      if (!currentRail || !targetRail) return current;
      rails[index] = targetRail;
      rails[targetIndex] = currentRail;
      return { ...current, rails };
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<AdminSettings>) => {
    setSnapshot((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  }, []);

  const resetDemo = useCallback(() => {
    setSnapshot(createDemoSnapshot());
  }, []);

  return [
    snapshot,
    {
      updateVideo,
      replaceVideos,
      replaceSnapshot,
      addMockSources,
      updateJob,
      toggleDvdCandidate,
      startSelectedDvdConversion,
      retryJob,
      createUploadJob,
      updateDevice,
      updateRail,
      moveRail,
      updateSettings,
      resetDemo,
    },
  ];
}
