import type { MessageRecord } from '../types';

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFilename(topic: string): string {
  return topic.replace(/[^\w.-]+/g, '_') || 'topic';
}

function timestampSuffix(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export type MessageExportFormat = 'json' | 'csv';

export function exportMessages(
  messages: MessageRecord[],
  topic: string,
  format: MessageExportFormat,
): void {
  if (messages.length === 0) {
    return;
  }

  const base = `${safeFilename(topic)}-messages-${timestampSuffix()}`;

  if (format === 'json') {
    const payload = {
      topic,
      exportedAt: new Date().toISOString(),
      count: messages.length,
      messages,
    };
    const json = JSON.stringify(payload, null, 2);
    downloadBlob(`${base}.json`, new Blob([json], { type: 'application/json;charset=utf-8' }));
    return;
  }

  const header = ['partition', 'offset', 'key', 'value', 'timestamp', 'headers', 'isJson'];
  const rows = messages.map((m) => {
    const headers = m.headers?.length ? JSON.stringify(m.headers) : '';
    return [
      String(m.partition),
      String(m.offset),
      m.key ?? '',
      m.value ?? '',
      new Date(m.timestamp).toISOString(),
      headers,
      m.isJson ? 'true' : 'false',
    ]
      .map(escapeCsvField)
      .join(',');
  });

  const csv = [header.join(','), ...rows].join('\r\n');
  downloadBlob(`${base}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}
