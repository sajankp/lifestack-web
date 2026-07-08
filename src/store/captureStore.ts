import { create } from 'zustand';

interface CaptureState {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  isOpen: false,
  setIsOpen: (isOpen) => set({ isOpen }),
}));
