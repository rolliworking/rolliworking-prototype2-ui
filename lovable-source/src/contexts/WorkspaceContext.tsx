import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

const MAX_TABS = 5;

export type TabType = 
  | 'dashboard'
  | 'customers-list'
  | 'vendors-list'
  | 'parts-list'
  | 'po-list'
  | 'po-draft'
  | 'po-issued'
  | 'po-received'
  | 'customer'
  | 'vendor'
  | 'part'
  | 'po'
  | 'new-po'
  | 'new-customer'
  | 'new-vendor'
  | 'new-part'
  | 'estimates-list'
  | 'estimate'
  | 'new-estimate'
  | 'reports'
  | 'settings'
  | 'vendor-drafts'
  | 'reorder-drafts'
  | 'saved-pos'
  | 'job-templates'
  | 'email-templates'
  // Intake submenu tabs
  | 'intake-leads'
  | 'intake-email'
  | 'intake-inspections'
  | 'intake-receive'
  // Inventory submenu tabs
  | 'calibers'
  | 'reorder-alerts'
  | 'cycle-count'
  | 'quick-move'
  | 'client-property'
  | 'products-services'
  // Purchasing submenu tabs
  | 'disassembly-orders'
  | 'receiving'
  // Sales submenu tabs
  | 'sales-orders'
  // Estimates submenu tabs
  | 'waitlist'
  // Reports submenu tabs
  | 'analytics'
  | 'band-funnel'
  | 'inventory-report'
  | 'transactions-report';

export interface WorkspaceTab {
  id: string;
  type: TabType;
  title: string;
  icon?: string;
  recordId?: string;
  isDirty?: boolean;
  data?: Record<string, any>;
}

interface PendingTabClose {
  tabToClose: WorkspaceTab;
  newTabConfig: Omit<WorkspaceTab, 'id'> & { id?: string };
}

interface WorkspaceContextType {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  openTab: (tab: Omit<WorkspaceTab, 'id'> & { id?: string }) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<WorkspaceTab>) => void;
  getTab: (tabId: string) => WorkspaceTab | undefined;
  findTabByRecord: (type: TabType, recordId: string) => WorkspaceTab | undefined;
  markDirty: (tabId: string, dirty: boolean) => void;
  // For dirty tab confirmation
  pendingClose: PendingTabClose | null;
  confirmPendingClose: () => void;
  cancelPendingClose: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState<PendingTabClose | null>(null);

  const generateTabId = useCallback(() => {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const findTabByRecord = useCallback((type: TabType, recordId: string) => {
    return tabs.find(tab => tab.type === type && tab.recordId === recordId);
  }, [tabs]);

  const openTab = useCallback((tabConfig: Omit<WorkspaceTab, 'id'> & { id?: string }) => {
    // Check if tab already exists for this record
    if (tabConfig.recordId) {
      const existingTab = findTabByRecord(tabConfig.type, tabConfig.recordId);
      if (existingTab) {
        setActiveTabId(existingTab.id);
        return;
      }
    }

    // For list tabs and specific singleton tabs, check by type only
    const singletonTypes: TabType[] = [
      'dashboard', 'customers-list', 'vendors-list', 'parts-list',
      'po-list', 'po-draft', 'po-issued', 'po-received', 
      'estimates-list', 'reports', 'settings',
      'vendor-drafts', 'reorder-drafts', 'saved-pos', 'job-templates', 'email-templates',
      // Intake tabs
      'intake-leads', 'intake-email', 'intake-inspections', 'intake-receive',
      // Inventory tabs
      'calibers', 'reorder-alerts', 'cycle-count', 'quick-move', 'client-property', 'products-services',
      // Purchasing tabs
      'disassembly-orders', 'receiving',
      // Sales tabs
      'sales-orders',
      // Estimates tabs
      'waitlist',
      // Reports tabs
      'analytics', 'band-funnel', 'inventory-report', 'transactions-report',
    ];
    
    if (singletonTypes.includes(tabConfig.type)) {
      const existingTab = tabs.find(tab => tab.type === tabConfig.type);
      if (existingTab) {
        // Update the title if it changed (for different sub-routes using same tab)
        if (existingTab.title !== tabConfig.title) {
          setTabs(prev => prev.map(t => 
            t.id === existingTab.id ? { ...t, title: tabConfig.title } : t
          ));
        }
        setActiveTabId(existingTab.id);
        return;
      }
    }

    // Check if we need to close oldest tab (rolling limit of 5)
    if (tabs.length >= MAX_TABS) {
      const oldestTab = tabs[0]; // First tab is oldest
      
      if (oldestTab.isDirty) {
        // Need confirmation before closing dirty tab
        setPendingClose({
          tabToClose: oldestTab,
          newTabConfig: tabConfig,
        });
        return;
      }
      
      // Close oldest tab and add new one
      const newTab: WorkspaceTab = {
        ...tabConfig,
        id: tabConfig.id || generateTabId(),
        isDirty: false,
      };
      
      setTabs(prev => [...prev.slice(1), newTab]);
      setActiveTabId(newTab.id);
      return;
    }

    const newTab: WorkspaceTab = {
      ...tabConfig,
      id: tabConfig.id || generateTabId(),
      isDirty: false,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs, findTabByRecord, generateTabId]);

  const confirmPendingClose = useCallback(() => {
    if (!pendingClose) return;
    
    const { tabToClose, newTabConfig } = pendingClose;
    
    const newTab: WorkspaceTab = {
      ...newTabConfig,
      id: newTabConfig.id || generateTabId(),
      isDirty: false,
    };
    
    setTabs(prev => [...prev.filter(t => t.id !== tabToClose.id), newTab]);
    setActiveTabId(newTab.id);
    setPendingClose(null);
  }, [pendingClose, generateTabId]);

  const cancelPendingClose = useCallback(() => {
    setPendingClose(null);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const tabIndex = prev.findIndex(t => t.id === tabId);
      const newTabs = prev.filter(t => t.id !== tabId);
      
      // If closing the active tab, activate another tab
      if (activeTabId === tabId && newTabs.length > 0) {
        const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
        setActiveTabId(newTabs[newActiveIndex]?.id || null);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
      }
      
      return newTabs;
    });
  }, [activeTabId]);

  const updateTab = useCallback((tabId: string, updates: Partial<WorkspaceTab>) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, ...updates } : tab
    ));
  }, []);

  const getTab = useCallback((tabId: string) => {
    return tabs.find(t => t.id === tabId);
  }, [tabs]);

  const markDirty = useCallback((tabId: string, dirty: boolean) => {
    updateTab(tabId, { isDirty: dirty });
  }, [updateTab]);

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        tabs,
        activeTabId,
        openTab,
        closeTab,
        setActiveTab,
        updateTab,
        getTab,
        findTabByRecord,
        markDirty,
        pendingClose,
        confirmPendingClose,
        cancelPendingClose,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
