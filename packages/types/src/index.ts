// ==============================================
// Shared TypeScript Types for RolliSuite
// ==============================================
// These types are used across frontend and backend
// ==============================================

// Re-export Prisma types
export type * from '@prisma/client';

// ============================================== 
// User & Auth Types
// ==============================================

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  role: AppRole;
  permissions: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface PinLoginRequest {
  userId: string;
  pin: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  expiresIn: string;
}

export enum AppRole {
  Admin = 'admin',
  Manager = 'manager',
  Office = 'office',
  FrontDesk = 'front_desk',
  Staff = 'staff',
  BandRoom = 'band_room',
}

// ==============================================
// API Response Types
// ==============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// ==============================================
// Customer Types
// ==============================================

export interface CustomerDTO {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  displayName?: string;
  qboCustomerId?: string;
  isShipDirect: boolean;
  isTradePricing: boolean;
}

// ==============================================
// Estimate Types
// ==============================================

export enum EstimateStatus {
  Draft = 'draft',
  Sent = 'sent',
  Approved = 'approved',
  Converted = 'converted',
  Declined = 'declined',
  Expired = 'expired',
  OnHold = 'on_hold',
}

export interface EstimateDTO {
  id: string;
  estimateNumber: string;
  customerId: string;
  status: EstimateStatus;
  sentAt?: Date;
  convertedAt?: Date;
  total: number;
  lineItems: EstimateLineItemDTO[];
}

export interface EstimateLineItemDTO {
  id: string;
  estimateId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  partId?: string;
  lineType: string;
}

// ==============================================
// Sales Order Types
// ==============================================

export enum SalesOrderStatus {
  Draft = 'draft',
  Pending = 'pending',
  Fulfilled = 'fulfilled',
  Shipped = 'shipped',
  PickedUp = 'picked_up',
  Closed = 'closed',
}

export interface SalesOrderDTO {
  id: string;
  soNumber: string;
  customerId: string;
  status: SalesOrderStatus;
  isPaid: boolean;
  balanceDue: number;
  total: number;
  qboInvoiceId?: string;
}

// ==============================================
// More types to be added as modules are built
// ==============================================

// TODO: Add types for:
// - Jobs
// - Inventory & Parts
// - Purchasing
// - Shipping
// - RolliWorking integration
// - QBO integration
// etc...
