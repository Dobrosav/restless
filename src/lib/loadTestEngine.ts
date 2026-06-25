export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface LoadTestTarget {
  id: string
  url: string
  method: HttpMethod
  headers: Record<string, string>
  body: string
  weight: number // 0-100
}

export interface LoadTestConfig {
  targets: LoadTestTarget[]
  totalRequests: number
  concurrency: number
  rampUpSeconds: number
  timeoutMs: number
}

export interface LoadTestResult {
  targetId: string
  targetUrl: string
  targetMethod: string
  status: number
  responseTime: number
  timestamp: number
  error?: string
  size: number
}

export interface LoadTestTargetSummary {
  targetId: string
  targetUrl: string
  targetMethod: string
  totalRequests: number
  successCount: number
  errorCount: number
  avgResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  p50: number
  p95: number
  p99: number
  statusDistribution: Record<number, number>
}

export interface LoadTestSummary {
  totalRequests: number
  completedRequests: number
  successCount: number
  errorCount: number
  avgResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  p50: number
  p95: number
  p99: number
  requestsPerSecond: number
  statusDistribution: Record<number, number>
  timeline: { timestamp: number; responseTime: number; status: number }[]
  perTarget: LoadTestTargetSummary[]
  elapsedMs: number
}

export interface LoadTestProgress {
  completed: number
  total: number
  currentRps: number
  latestResult: LoadTestResult
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function selectTarget(targets: LoadTestTarget[]): LoadTestTarget {
  const totalWeight = targets.reduce((sum, t) => sum + t.weight, 0)
  if (totalWeight <= 0) return targets[0]

  let rand = Math.random() * totalWeight
  for (const target of targets) {
    rand -= target.weight
    if (rand <= 0) return target
  }
  return targets[targets.length - 1]
}

async function sendSingleRequest(
  target: LoadTestTarget,
  timeoutMs: number,
  abortSignal: AbortSignal
): Promise<LoadTestResult> {
  const startTime = performance.now()
  const timestamp = Date.now()

  let url = target.url
  if (url && !/^https?:\/\//i.test(url)) {
    url = 'http://' + url
  }

  try {
    const fetchOptions: RequestInit = {
      method: target.method,
      headers: target.headers,
      signal: abortSignal,
    }

    if (target.body && !['GET', 'HEAD'].includes(target.method)) {
      fetchOptions.body = target.body
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    // Chain abort: if parent aborts, abort this controller too
    abortSignal.addEventListener('abort', () => controller.abort())

    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const endTime = performance.now()
    const body = await response.text()

    return {
      targetId: target.id,
      targetUrl: target.url,
      targetMethod: target.method,
      status: response.status,
      responseTime: Math.round(endTime - startTime),
      timestamp,
      size: new Blob([body]).size,
    }
  } catch (error: any) {
    const endTime = performance.now()
    return {
      targetId: target.id,
      targetUrl: target.url,
      targetMethod: target.method,
      status: 0,
      responseTime: Math.round(endTime - startTime),
      timestamp,
      error: error.name === 'AbortError' ? 'Timeout / Cancelled' : (error.message || 'Unknown error'),
      size: 0,
    }
  }
}

function computeSummary(results: LoadTestResult[], elapsedMs: number): LoadTestSummary {
  const times = results.map(r => r.responseTime).sort((a, b) => a - b)
  const successResults = results.filter(r => r.status >= 200 && r.status < 400)
  const errorResults = results.filter(r => r.status === 0 || r.status >= 400)

  const statusDist: Record<number, number> = {}
  results.forEach(r => {
    statusDist[r.status] = (statusDist[r.status] || 0) + 1
  })

  // Per-target summaries
  const targetMap = new Map<string, LoadTestResult[]>()
  results.forEach(r => {
    const list = targetMap.get(r.targetId) || []
    list.push(r)
    targetMap.set(r.targetId, list)
  })

  const perTarget: LoadTestTargetSummary[] = Array.from(targetMap.entries()).map(([targetId, tResults]) => {
    const tTimes = tResults.map(r => r.responseTime).sort((a, b) => a - b)
    const tSuccess = tResults.filter(r => r.status >= 200 && r.status < 400)
    const tError = tResults.filter(r => r.status === 0 || r.status >= 400)
    const tStatusDist: Record<number, number> = {}
    tResults.forEach(r => { tStatusDist[r.status] = (tStatusDist[r.status] || 0) + 1 })

    return {
      targetId,
      targetUrl: tResults[0]?.targetUrl || '',
      targetMethod: tResults[0]?.targetMethod || '',
      totalRequests: tResults.length,
      successCount: tSuccess.length,
      errorCount: tError.length,
      avgResponseTime: tTimes.length > 0 ? Math.round(tTimes.reduce((a, b) => a + b, 0) / tTimes.length) : 0,
      minResponseTime: tTimes[0] || 0,
      maxResponseTime: tTimes[tTimes.length - 1] || 0,
      p50: percentile(tTimes, 50),
      p95: percentile(tTimes, 95),
      p99: percentile(tTimes, 99),
      statusDistribution: tStatusDist,
    }
  })

  const elapsedSec = elapsedMs / 1000

  return {
    totalRequests: results.length,
    completedRequests: results.length,
    successCount: successResults.length,
    errorCount: errorResults.length,
    avgResponseTime: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
    minResponseTime: times[0] || 0,
    maxResponseTime: times[times.length - 1] || 0,
    p50: percentile(times, 50),
    p95: percentile(times, 95),
    p99: percentile(times, 99),
    requestsPerSecond: elapsedSec > 0 ? Math.round((results.length / elapsedSec) * 100) / 100 : 0,
    statusDistribution: statusDist,
    timeline: results.map(r => ({
      timestamp: r.timestamp,
      responseTime: r.responseTime,
      status: r.status,
    })),
    perTarget,
    elapsedMs,
  }
}

export class LoadTestRunner {
  private abortController: AbortController | null = null
  private running = false

  isRunning(): boolean {
    return this.running
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
    this.running = false
  }

  async run(
    config: LoadTestConfig,
    onProgress: (progress: LoadTestProgress) => void,
    onComplete: (summary: LoadTestSummary) => void
  ): Promise<void> {
    if (this.running) return

    this.running = true
    this.abortController = new AbortController()
    const { signal } = this.abortController

    const results: LoadTestResult[] = []
    const startTime = performance.now()

    // Build request queue based on weights
    const queue: LoadTestTarget[] = []
    for (let i = 0; i < config.totalRequests; i++) {
      queue.push(selectTarget(config.targets))
    }

    let completedCount = 0
    let activeCount = 0
    let queueIndex = 0

    return new Promise<void>((resolve) => {
      const processNext = () => {
        if (signal.aborted || !this.running) {
          if (activeCount === 0) {
            this.running = false
            const elapsed = performance.now() - startTime
            onComplete(computeSummary(results, elapsed))
            resolve()
          }
          return
        }

        while (activeCount < config.concurrency && queueIndex < queue.length && !signal.aborted) {
          const target = queue[queueIndex++]
          activeCount++

          sendSingleRequest(target, config.timeoutMs, signal).then(result => {
            activeCount--
            completedCount++
            results.push(result)

            const elapsed = performance.now() - startTime
            const rps = elapsed > 0 ? Math.round((completedCount / (elapsed / 1000)) * 100) / 100 : 0

            onProgress({
              completed: completedCount,
              total: config.totalRequests,
              currentRps: rps,
              latestResult: result,
            })

            if (completedCount >= config.totalRequests) {
              this.running = false
              const finalElapsed = performance.now() - startTime
              onComplete(computeSummary(results, finalElapsed))
              resolve()
            } else {
              processNext()
            }
          })
        }
      }

      processNext()
    })
  }
}

export function createLoadTestRunner(): LoadTestRunner {
  return new LoadTestRunner()
}
