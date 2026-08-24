import { z } from 'zod';

export const UploadRequestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  maxDurationSeconds: z.number().int().min(1).max(86_400),
  creatorId: z.string().trim().min(1).max(128).optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.string().max(1_000)).optional(),
});

export const PlaybackRequestSchema = z.object({
  preferredFormat: z.enum(['mp4', 'hls']).optional(),
  // Cloudflare's native Stream binding issues fixed one-hour tokens.
  tokenTtlSeconds: z.literal(3_600).optional(),
});

export const ProgressRequestSchema = z.object({
  positionSeconds: z.number().nonnegative(),
  durationSeconds: z.number().positive().nullable(),
  completed: z.boolean(),
  watchedAt: z.string().datetime(),
});

export const PairingRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  platform: z.enum(['tvos', 'windows', 'web', 'unknown']),
});

export const PairingApprovalSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^[A-Z2-9]+$/u),
  userId: z.string().trim().min(1).max(128),
});

export const PairingDenialSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^[A-Z2-9]+$/u),
});

export const StreamWebhookSchema = z
  .object({
    uid: z.string().min(1),
    readyToStream: z.boolean(),
    status: z.object({
      state: z.string(),
      pctComplete: z.string().optional(),
      errorReasonCode: z.string().optional(),
      errorReasonText: z.string().optional(),
    }),
    created: z.string().optional(),
    modified: z.string().optional(),
  })
  .passthrough();

export type ProgressRequest = z.infer<typeof ProgressRequestSchema>;
export type PairingRequest = z.infer<typeof PairingRequestSchema>;
