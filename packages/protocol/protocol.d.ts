export type MediaKey = 'play_pause' | 'next' | 'previous' | 'volume_up' | 'volume_down' | 'volume_mute';
export type SystemKey = 'lock';
export type MacroCondition = 'always' | 'previous_success' | 'previous_failed';
export type PrimitiveAction =
  | { type: 'open_url'; url: string }
  | { type: 'launch_app'; path: string; args?: string[] }
  | { type: 'hotkey'; keys: string[] }
  | { type: 'media'; key: MediaKey }
  | { type: 'system'; key: SystemKey }
  | { type: 'integration'; service: 'obs' | 'spotify' | 'discord' | 'browser'; command: string; params?: Record<string, unknown> };
export type MacroStep = { id: string; when: MacroCondition; delayMs: number; action: PrimitiveAction };
export type MacroAction = { type: 'macro'; stopOnError: boolean; steps: MacroStep[] };
export type NexusAction = PrimitiveAction | MacroAction;

export interface ActiveApp { processName: string; processPath?: string; windowTitle?: string; pid?: number }
export interface SecureEnvelope { v: 1; iv: string; ciphertext: string }
export interface CommandMessage { type: 'command'; id: string; ts: number; body: { action: NexusAction } }
export interface AckMessage { type: 'ack'; id: string; ts: number; body: { commandId: string; ok: boolean; error?: string } }
export interface IntegrationStatus { id: string; name: string; kind: string; configured: boolean; connected: boolean; detail?: string; state?: Record<string, unknown>; error?: string }
export interface StatusMessage { type: 'status'; id: string; ts: number; body: { online: boolean; hostname: string; platform: string; version: string; transport?: 'local' | 'cloud'; uptimeSeconds?: number; activeApp?: ActiveApp; integrations?: Record<string, IntegrationStatus> } }
export interface LocalPeer { id: string; secret: string; name: string; platform: string; transport: 'local'; protocolVersion: number }
