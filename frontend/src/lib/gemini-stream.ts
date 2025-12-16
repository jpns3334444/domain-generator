import { StreamEvent, GenerateStreamRequest } from '@/types/conversation';

export async function* streamDomainGeneration(
  request: GenerateStreamRequest
): AsyncGenerator<StreamEvent> {
  const response = await fetch('/api/generate/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    yield { type: 'error', error: 'Failed to start generation' };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', error: 'No response body' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr) {
            try {
              const event: StreamEvent = JSON.parse(jsonStr);
              yield event;

              if (event.type === 'done') {
                return;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr) {
            try {
              const event: StreamEvent = JSON.parse(jsonStr);
              yield event;
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    }
  } catch (error) {
    yield { type: 'error', error: String(error) };
  } finally {
    reader.releaseLock();
  }
}
