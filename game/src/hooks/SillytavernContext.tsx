import React, { createContext, useContext } from 'react';
import { useSillytavern, type SillytavernContextType } from './useSillytavern';

const SillytavernCtx = createContext<SillytavernContextType | null>(null);

export function SillytavernProvider({ children }: { children: React.ReactNode }) {
  const ss = useSillytavern();
  return <SillytavernCtx.Provider value={ss}>{children}</SillytavernCtx.Provider>;
}

export function useSS() {
  const ctx = useContext(SillytavernCtx);
  if (!ctx) throw new Error('useSS must be used within SillytavernProvider');
  return ctx;
}
