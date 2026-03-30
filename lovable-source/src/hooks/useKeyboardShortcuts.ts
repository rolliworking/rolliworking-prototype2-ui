import { useEffect, useCallback } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function useKeyboardShortcuts() {
  const { tabs, activeTabId, closeTab, setActiveTab } = useWorkspace();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    // Ctrl/Cmd + W: Close current tab
    if (modKey && e.key === 'w') {
      e.preventDefault();
      if (activeTabId) {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab) {
          // If dirty, the close will be handled by TabBar's confirmation dialog
          // For now, just trigger close - the WorkspaceContext handles dirty state
          closeTab(activeTabId);
        }
      }
    }

    // Ctrl/Cmd + Tab: Cycle to next tab
    if (modKey && e.key === 'Tab') {
      e.preventDefault();
      if (tabs.length > 1 && activeTabId) {
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        const nextIndex = e.shiftKey 
          ? (currentIndex - 1 + tabs.length) % tabs.length 
          : (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex].id);
      }
    }

    // Ctrl/Cmd + K: Focus global search (placeholder)
    if (modKey && e.key === 'k') {
      e.preventDefault();
      // Focus the search input in the header
      const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }

    // Ctrl/Cmd + 1-9: Switch to tab by number
    if (modKey && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const tabIndex = parseInt(e.key) - 1;
      if (tabs[tabIndex]) {
        setActiveTab(tabs[tabIndex].id);
      }
    }
  }, [tabs, activeTabId, closeTab, setActiveTab]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
