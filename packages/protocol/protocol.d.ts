export type MediaKey = 'play_pause' | 'next' | 'previous' | 'volume_up' | 'volume_down' | 'volume_mute';
export type NexusAction =
  | { type: 'open_url'; url: string }
  | { type: 'launch_app'; path: string; args?: string[] }
  | { type: 'hotkey'; keys: string[] }
  | { type: 'media'; key: MediaKey };

export interface SecureEnvelope { v: 1; iv: string; ciphertext: string }
export interface CommandMessage { type: 'command'; id: string; ts: number; body: { action: NexusAction } }
export interface AckMessage { type: 'ack'; id: string; ts: number; body: { commandId: string; ok: boolean; error?: string } }
export interface StatusMessage { type: 'status'; id: string; ts: number; body: { online: boolean; hostname: string; platform: string; version: string } }
