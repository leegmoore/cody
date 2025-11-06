/**
 * Client for interacting with a local Ollama instance
 *
 * Ported from codex-rs/ollama/src/client.rs
 */

import { pullEventsFromValue, type PullEvent } from './parser.js'
import type { PullProgressReporter } from './pull.js'
import { baseUrlToHostRoot, isOpenAiCompatibleBaseUrl } from './url.js'

const OLLAMA_CONNECTION_ERROR =
  'No running Ollama server detected. Start it with: `ollama serve` (after installing). Install instructions: https://github.com/ollama/ollama?tab=readme-ov-file#ollama'

/**
 * Client for interacting with a local Ollama instance.
 *
 * Supports both native Ollama API and OpenAI-compatible endpoints.
 */
export class OllamaClient {
  private readonly hostRoot: string
  private readonly usesOpenaiCompat: boolean
  private readonly connectTimeout: number

  /**
   * Construct a client with the given host root URL.
   *
   * @param hostRoot - Base URL for the Ollama server (e.g., "http://localhost:11434")
   * @param usesOpenaiCompat - Whether to use OpenAI-compatible endpoints
   * @param connectTimeout - Connection timeout in milliseconds (default: 5000)
   */
  constructor(hostRoot: string, usesOpenaiCompat: boolean = false, connectTimeout: number = 5000) {
    this.hostRoot = hostRoot
    this.usesOpenaiCompat = usesOpenaiCompat
    this.connectTimeout = connectTimeout
  }

  /**
   * Create a client from a base URL and verify the server is reachable.
   *
   * @param baseUrl - Base URL for the Ollama server
   * @returns Promise resolving to a new OllamaClient
   * @throws Error if server is not reachable
   */
  static async fromBaseUrl(baseUrl: string): Promise<OllamaClient> {
    const usesOpenaiCompat = isOpenAiCompatibleBaseUrl(baseUrl)
    const hostRoot = baseUrlToHostRoot(baseUrl)

    const client = new OllamaClient(hostRoot, usesOpenaiCompat)
    await client.probeServer()
    return client
  }

  /**
   * Probe whether the server is reachable by hitting the appropriate health endpoint.
   *
   * @throws Error if server is not reachable
   */
  private async probeServer(): Promise<void> {
    const url = this.usesOpenaiCompat
      ? `${this.hostRoot.replace(/\/$/, '')}/v1/models`
      : `${this.hostRoot.replace(/\/$/, '')}/api/tags`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.connectTimeout)

      const resp = await fetch(url, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`)
      }
    } catch (err) {
      throw new Error(OLLAMA_CONNECTION_ERROR)
    }
  }

  /**
   * Return the list of model names known to the local Ollama instance.
   *
   * @returns Promise resolving to array of model names
   */
  async fetchModels(): Promise<string[]> {
    const tagsUrl = `${this.hostRoot.replace(/\/$/, '')}/api/tags`

    try {
      const resp = await fetch(tagsUrl)

      if (!resp.ok) {
        return []
      }

      const data = await resp.json()
      const models = data?.models

      if (!Array.isArray(models)) {
        return []
      }

      return models.map((m: any) => m.name).filter((name): name is string => typeof name === 'string')
    } catch {
      return []
    }
  }

  /**
   * Start a model pull and return an async iterable of streaming events.
   *
   * The stream ends when a Success event is observed or the server closes the connection.
   *
   * @param model - Model name to pull (e.g., "llama3.2:3b")
   * @returns AsyncIterable of PullEvent
   * @throws Error if pull fails to start
   */
  async *pullModelStream(model: string): AsyncIterable<PullEvent> {
    const url = `${this.hostRoot.replace(/\/$/, '')}/api/pull`

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, stream: true }),
    })

    if (!resp.ok) {
      throw new Error(`Failed to start pull: HTTP ${resp.status}`)
    }

    if (!resp.body) {
      throw new Error('Response body is null')
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        // Append chunk to buffer
        buffer += decoder.decode(value, { stream: true })

        // Process complete lines
        let newlineIdx: number
        while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIdx).trim()
          buffer = buffer.slice(newlineIdx + 1)

          if (line.length === 0) {
            continue
          }

          try {
            const value = JSON.parse(line)

            // Yield events from this JSON object
            for (const event of pullEventsFromValue(value)) {
              yield event
            }

            // Check for error
            if (value.error) {
              yield { type: 'error', message: String(value.error) }
              return
            }

            // Check for success
            if (value.status === 'success') {
              yield { type: 'success' }
              return
            }
          } catch {
            // Ignore malformed JSON lines
            continue
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * High-level helper to pull a model and drive a progress reporter.
   *
   * @param model - Model name to pull
   * @param reporter - Progress reporter to receive events
   * @throws Error if pull fails
   */
  async pullWithReporter(model: string, reporter: PullProgressReporter): Promise<void> {
    reporter.onEvent({ type: 'status', status: `Pulling model ${model}...` })

    for await (const event of this.pullModelStream(model)) {
      reporter.onEvent(event)

      if (event.type === 'success') {
        return
      }

      if (event.type === 'error') {
        // Empirically, ollama returns a 200 OK response even when
        // the output stream includes an error message. We have to check
        // the event stream to determine whether to throw an error.
        throw new Error(`Pull failed: ${event.message}`)
      }
    }

    throw new Error('Pull stream ended unexpectedly without success')
  }
}
