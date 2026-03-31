import * as React from "react";

export interface QueuedPage {
  id: string;
  pageNumber: number;
  totalPages: number;
  filename: string;
  dataUrl: string;
  status: "pending" | "processing" | "done" | "skipped";
}

interface ScantronQueueState {
  queue: QueuedPage[];
  currentIndex: number;
  isActive: boolean;
}

// Global state to persist queue across component unmounts
let _globalState: ScantronQueueState = {
  queue: [],
  currentIndex: 0,
  isActive: false,
};

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((cb) => cb());
}

export function useScantronQueue() {
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    listeners.add(forceUpdate);
    return () => {
      listeners.delete(forceUpdate);
    };
  }, []);

  const enqueue = React.useCallback((pages: Omit<QueuedPage, "status">[]) => {
    const newPages: QueuedPage[] = pages.map((p) => ({
      ...p,
      status: "pending" as const,
    }));
    _globalState = {
      queue: [..._globalState.queue, ...newPages],
      currentIndex: _globalState.queue.length === 0 ? 0 : _globalState.currentIndex,
      isActive: true,
    };
    emitChange();
  }, []);

  const clearQueue = React.useCallback(() => {
    _globalState = { queue: [], currentIndex: 0, isActive: false };
    emitChange();
  }, []);

  const markCurrentDone = React.useCallback(() => {
    if (_globalState.queue.length === 0) return;
    const updated = [..._globalState.queue];
    if (updated[_globalState.currentIndex]) {
      updated[_globalState.currentIndex] = {
        ...updated[_globalState.currentIndex],
        status: "done",
      };
    }
    _globalState = { ..._globalState, queue: updated };
    emitChange();
  }, []);

  const markCurrentSkipped = React.useCallback(() => {
    if (_globalState.queue.length === 0) return;
    const updated = [..._globalState.queue];
    if (updated[_globalState.currentIndex]) {
      updated[_globalState.currentIndex] = {
        ...updated[_globalState.currentIndex],
        status: "skipped",
      };
    }
    _globalState = { ..._globalState, queue: updated };
    emitChange();
  }, []);

  const markCurrentProcessing = React.useCallback(() => {
    if (_globalState.queue.length === 0) return;
    const updated = [..._globalState.queue];
    if (updated[_globalState.currentIndex]) {
      updated[_globalState.currentIndex] = {
        ...updated[_globalState.currentIndex],
        status: "processing",
      };
    }
    _globalState = { ..._globalState, queue: updated };
    emitChange();
  }, []);

  const advanceToNext = React.useCallback(() => {
    const nextIndex = _globalState.currentIndex + 1;
    if (nextIndex >= _globalState.queue.length) {
      // Queue complete
      _globalState = { ..._globalState, isActive: false };
      emitChange();
      return false;
    }
    _globalState = { ..._globalState, currentIndex: nextIndex };
    emitChange();
    return true;
  }, []);

  const goToIndex = React.useCallback((index: number) => {
    if (index < 0 || index >= _globalState.queue.length) return;
    _globalState = { ..._globalState, currentIndex: index };
    emitChange();
  }, []);

  const currentPage = _globalState.queue[_globalState.currentIndex] || null;
  const remainingCount = _globalState.queue.filter((p) => p.status === "pending").length;
  const doneCount = _globalState.queue.filter((p) => p.status === "done").length;

  return {
    queue: _globalState.queue,
    currentIndex: _globalState.currentIndex,
    currentPage,
    isActive: _globalState.isActive,
    remainingCount,
    doneCount,
    totalCount: _globalState.queue.length,
    enqueue,
    clearQueue,
    markCurrentDone,
    markCurrentSkipped,
    markCurrentProcessing,
    advanceToNext,
    goToIndex,
  };
}
