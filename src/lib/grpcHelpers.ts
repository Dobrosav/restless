import { KeyValue, Environment, GrpcConfig } from '../types'

/**
 * Interpolates {{variable}} placeholders in a string using environment variables.
 */
export function interpolateGrpc(text: string, environment: Environment | null): string {
  if (!text || !environment) return text
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const v = environment.variables?.find((v) => v.enabled && v.key === key.trim())
    return v ? v.value : match
  })
}

/**
 * Parses and interpolates a gRPC JSON message string.
 * Returns { ok: true, data } on success or { ok: false, error } on failure.
 */
export function parseGrpcMessage(
  messageStr: string,
  environment: Environment | null
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const interpolated = interpolateGrpc(messageStr || '{}', environment)
  try {
    const data = JSON.parse(interpolated)
    return { ok: true, data }
  } catch {
    return { ok: false, error: `Invalid JSON: ${interpolated}` }
  }
}

/**
 * Builds a flat metadata array [{key, value}] from KeyValue[] with env interpolation.
 * Filters out disabled and empty-key entries.
 */
export function buildGrpcMetadata(
  metadata: KeyValue[],
  environment: Environment | null
): Array<{ key: string; value: string }> {
  return metadata
    .filter((m) => m.enabled && m.key.trim())
    .map((m) => ({
      key: interpolateGrpc(m.key, environment),
      value: interpolateGrpc(m.value, environment),
    }))
}

/**
 * Validates that a GrpcConfig has the required fields.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateGrpcConfig(config: GrpcConfig): string | null {
  if (!config.proto?.trim()) return 'Proto definition is empty'
  if (!config.service?.trim()) return 'Service name is required'
  if (!config.method?.trim()) return 'Method name is required'
  return null
}

/**
 * Resolves a dot-separated service name against a proto descriptor object.
 * e.g. "hello.Greeter" → descriptor.hello.Greeter
 * Returns the service constructor or null if not found.
 */
export function resolveService(
  descriptor: Record<string, unknown>,
  serviceName: string
): (new (...args: unknown[]) => unknown) | null {
  const parts = serviceName.split('.')
  let current: unknown = descriptor
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return null
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'function'
    ? (current as new (...args: unknown[]) => unknown)
    : null
}
