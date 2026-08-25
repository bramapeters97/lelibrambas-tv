import { GatewayError } from './errors.js';

const MAX_JSON_BYTES = 8 * 1024;
const MAX_FORM_BYTES = 4 * 1024;

export interface BeginAuthorizationRequest {
  readonly deviceName: string;
}

export interface CatalogSourceItem {
  readonly id: number;
  readonly title: string;
  readonly year: number | null;
  readonly description: string;
  readonly category: string;
  readonly posterUrl: string;
  readonly backdropUrl: string | null;
  readonly streamVideoId: string | null;
  readonly playbackAssetId: string | null;
  readonly sortOrder: number;
  readonly featured: boolean;
  readonly previewStartSeconds: number;
}

export interface ActivationDecision {
  readonly userCode: string;
  readonly action: 'approve' | 'deny';
  readonly csrfToken: string;
}

async function boundedText(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<string> {
  if (body === null) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > limit) {
      await reader.cancel('Body exceeded the configured limit').catch(() => undefined);
      throw new GatewayError(413, 'BODY_TOO_LARGE', 'The request body is too large.');
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

function objectValue(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function parseBeginAuthorization(
  request: Request,
): Promise<BeginAuthorizationRequest> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new GatewayError(415, 'CONTENT_TYPE_REQUIRED', 'Send an application/json body.');
  }
  const raw = await boundedText(request.body, MAX_JSON_BYTES);
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new GatewayError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }
  const object = objectValue(value);
  const candidate = object?.deviceName ?? object?.device_name;
  if (typeof candidate !== 'string') {
    throw new GatewayError(400, 'INVALID_DEVICE_NAME', 'A device name is required.');
  }
  const deviceName = candidate.trim().replace(/\s+/gu, ' ');
  if (deviceName.length < 1 || deviceName.length > 80) {
    throw new GatewayError(
      400,
      'INVALID_DEVICE_NAME',
      'The device name must be 1 to 80 characters.',
    );
  }
  return { deviceName };
}

export async function parseActivationDecision(request: Request): Promise<ActivationDecision> {
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/x-www-form-urlencoded')
  ) {
    throw new GatewayError(415, 'CONTENT_TYPE_REQUIRED', 'The activation form is not valid.');
  }
  const form = new URLSearchParams(await boundedText(request.body, MAX_FORM_BYTES));
  const action = form.get('action');
  if (action !== 'approve' && action !== 'deny') {
    throw new GatewayError(400, 'INVALID_DECISION', 'Choose approve or deny.');
  }
  const userCode = form.get('user_code')?.trim() ?? '';
  const csrfToken = form.get('csrf_token') ?? '';
  if (userCode.length > 16 || csrfToken.length > 256) {
    throw new GatewayError(400, 'INVALID_FORM', 'The activation form is not valid.');
  }
  return { userCode, action, csrfToken };
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function parseCatalogItem(value: unknown, index: number): CatalogSourceItem {
  const object = objectValue(value);
  if (object === null) {
    throw new GatewayError(
      502,
      'UPSTREAM_MALFORMED',
      'The catalog service returned malformed data.',
    );
  }
  const idValue = object.id;
  const id =
    typeof idValue === 'number' && Number.isSafeInteger(idValue)
      ? idValue
      : typeof idValue === 'string' && /^\d+$/u.test(idValue)
        ? Number(idValue)
        : Number.NaN;
  const title = typeof object.title === 'string' ? object.title.trim() : '';
  const category = typeof object.category === 'string' ? object.category.trim() : '';
  if (!Number.isSafeInteger(id) || id < 0 || title.length === 0 || category.length === 0) {
    throw new GatewayError(
      502,
      'UPSTREAM_MALFORMED',
      'The catalog service returned malformed data.',
    );
  }
  const year = object.year === null ? null : finiteNumber(object.year, Number.NaN);
  const normalizedYear =
    typeof year === 'number' && Number.isInteger(year) && year >= 1800 && year <= 2200
      ? year
      : null;
  return {
    id,
    title: title.slice(0, 240),
    year: normalizedYear,
    description: typeof object.description === 'string' ? object.description.slice(0, 8_000) : '',
    category: category.slice(0, 120),
    posterUrl: nullableString(object.poster_url) ?? '',
    backdropUrl: nullableString(object.backdrop_url),
    streamVideoId: nullableString(object.stream_video_id),
    playbackAssetId: nullableString(object.playback_asset_id),
    sortOrder: Math.trunc(finiteNumber(object.sort_order, id || index + 1)),
    featured: object.featured === true,
    previewStartSeconds: Math.max(0, finiteNumber(object.preview_start_seconds, 0)),
  };
}

export function parseCatalogPayload(value: unknown): readonly CatalogSourceItem[] {
  const object = objectValue(value);
  const records = Array.isArray(value)
    ? value
    : object !== null && Array.isArray(object.data)
      ? object.data
      : null;
  if (records === null || records.length > 5_000) {
    throw new GatewayError(
      502,
      'UPSTREAM_MALFORMED',
      'The catalog service returned malformed data.',
    );
  }
  const parsed = records.map(parseCatalogItem);
  if (new Set(parsed.map((item) => item.id)).size !== parsed.length) {
    throw new GatewayError(
      502,
      'UPSTREAM_MALFORMED',
      'The catalog service returned duplicate media identifiers.',
    );
  }
  return parsed;
}

export async function parseBoundedJsonResponse(
  response: Response,
  limitBytes: number,
): Promise<unknown> {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > limitBytes) {
    throw new GatewayError(
      502,
      'UPSTREAM_TOO_LARGE',
      'The catalog service returned too much data.',
    );
  }
  let raw: string;
  try {
    raw = await boundedText(response.body, limitBytes);
  } catch (error) {
    if (error instanceof GatewayError && error.code === 'BODY_TOO_LARGE') {
      throw new GatewayError(
        502,
        'UPSTREAM_TOO_LARGE',
        'The upstream service returned too much data.',
      );
    }
    throw error;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new GatewayError(
      502,
      'UPSTREAM_MALFORMED',
      'The catalog service returned malformed data.',
    );
  }
}
