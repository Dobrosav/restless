import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLoadTestRunner, LoadTestConfig } from './loadTestEngine'

describe('loadTestEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Mock performance.now
    let now = 1000
    vi.stubGlobal('performance', {
      now: () => now,
    })
    
    // Mock fetch
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      if (options?.signal?.aborted) {
        throw new Error('AbortError')
      }
      
      // Simulate some latency
      now += 50
      return {
        status: url.includes('error') ? 500 : 200,
        headers: new Headers({ 'content-length': '123' }),
        text: async () => 'mock response body'
      }
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('runs a basic load test successfully', async () => {
    const runner = createLoadTestRunner()
    
    const config: LoadTestConfig = {
      targets: [
        {
          id: 'target-1',
          url: 'http://api.example.com/success',
          method: 'GET',
          headers: {},
          body: '',
          weight: 100
        }
      ],
      totalRequests: 10,
      concurrency: 1,
      rampUpSeconds: 0,
      timeoutMs: 5000
    }

    const onProgress = vi.fn()

    const summary = await new Promise<any>((resolve) => {
      runner.run(config, onProgress, resolve)
      // Advance timers to trigger the next requests
      vi.runAllTimersAsync()
    })

    expect(onProgress).toHaveBeenCalled()
    expect(summary).toBeDefined()
    expect(summary.totalRequests).toBe(10)
    expect(summary.successCount).toBe(10)
    expect(summary.errorCount).toBe(0)
    
    // Each request takes 50ms
    expect(summary.avgResponseTime).toBe(50)
    expect(summary.p50).toBe(50)
    expect(summary.p95).toBe(50)
    expect(summary.perTarget[0].statusDistribution[200]).toBe(10)
  })

  it('handles target weight distribution', async () => {
    const runner = createLoadTestRunner()
    
    // We mock Math.random to strictly control selectTarget
    let randValue = 0.2 // will pick target-1 (weight 50)
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const val = randValue
      randValue = randValue === 0.2 ? 0.8 : 0.2 // alternate
      return val
    })

    const config: LoadTestConfig = {
      targets: [
        { id: 'target-1', url: 'http://api.example.com/t1', method: 'GET', headers: {}, body: '', weight: 50 },
        { id: 'target-2', url: 'http://api.example.com/t2', method: 'GET', headers: {}, body: '', weight: 50 }
      ],
      totalRequests: 4,
      concurrency: 1,
      rampUpSeconds: 0,
      timeoutMs: 5000
    }

    const summary = await new Promise<any>((resolve) => {
      runner.run(config, () => {}, resolve)
      vi.runAllTimersAsync()
    })

    expect(summary.perTarget.length).toBe(2)
    const t1 = summary.perTarget.find((t: any) => t.targetId === 'target-1')
    const t2 = summary.perTarget.find((t: any) => t.targetId === 'target-2')
    
    expect(t1.totalRequests).toBe(2)
    expect(t2.totalRequests).toBe(2)
    
    vi.restoreAllMocks()
  })

  it('counts errors correctly', async () => {
    const runner = createLoadTestRunner()
    
    const config: LoadTestConfig = {
      targets: [
        { id: 'target-1', url: 'http://api.example.com/error', method: 'GET', headers: {}, body: '', weight: 100 }
      ],
      totalRequests: 5,
      concurrency: 1,
      rampUpSeconds: 0,
      timeoutMs: 5000
    }

    const summary = await new Promise<any>((resolve) => {
      runner.run(config, () => {}, resolve)
      vi.runAllTimersAsync()
    })

    expect(summary.totalRequests).toBe(5)
    expect(summary.successCount).toBe(0)
    expect(summary.errorCount).toBe(5)
    expect(summary.statusDistribution[500]).toBe(5)
  })

  it('supports cancelling a test mid-flight', async () => {
    const runner = createLoadTestRunner()
    
    const config: LoadTestConfig = {
      targets: [
        { id: 'target-1', url: 'http://api.example.com/long', method: 'GET', headers: {}, body: '', weight: 100 }
      ],
      totalRequests: 100,
      concurrency: 1,
      rampUpSeconds: 0,
      timeoutMs: 5000
    }

    let progressCount = 0
    const onProgress = vi.fn(() => {
      progressCount++
      if (progressCount === 2) {
        runner.cancel()
      }
    })

    const summary = await new Promise<any>((resolve) => {
      runner.run(config, onProgress, resolve)
      vi.runAllTimersAsync()
    })

    // It should stop early
    expect(summary.totalRequests).toBeLessThan(100)
    expect(summary.completedRequests).toBe(2)
  })
})
