import { create } from 'zustand';

export type ToastData = { id: number; text: string; actionLabel?: string; onAction?: () => void };

type State = { toast: ToastData | null; show: (t: Omit<ToastData, 'id'>) => void; hide: () => void };

export const useToast = create<State>((set) => ({
  toast: null,
  show: (t) => set({ toast: { ...t, id: Date.now() } }),
  hide: () => set({ toast: null }),
}));

/** Uygulama içi kısa bildirim (isteğe bağlı "Geri al" eylemiyle) */
export function toast(text: string, action?: { label: string; onPress: () => void }) {
  useToast.getState().show({ text, actionLabel: action?.label, onAction: action?.onPress });
}
