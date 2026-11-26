import { createContext, useContext } from 'react';
import type { Me, SettingsDto } from '@shared/api';

export interface SessionCtx {
  me: Me;
  settings: SettingsDto;
  environment: string;
  refresh: () => void;
  has: (...roles: string[]) => boolean;
}

export const Session = createContext<SessionCtx | null>(null);
export function useSession(): SessionCtx {
  const s = useContext(Session);
  if (!s) throw new Error('No session');
  return s;
}
