
export type FileType = 'input' | 'results';
export type FileStatus = 'waiting' | 'loading' | 'valid' | 'invalid';

export interface LogEntry {
  message: string;
  type: 'info' | 'error' | 'success';
  timestamp: string;
}
