
'use client';

type ErrorListener = (error: any) => void;

class SimpleEventEmitter {
  private listeners: { [event: string]: ErrorListener[] } = {};

  on(event: string, listener: ErrorListener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(l => l(data));
    }
  }
}

export const errorEmitter = new SimpleEventEmitter();
