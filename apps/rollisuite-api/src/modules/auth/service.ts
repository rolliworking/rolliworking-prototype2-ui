// Auth Service - User authentication and registration
import { prisma } from '../../db/client';
import bcrypt from 'bcrypt';
import { config } from '../../config';

export interface RegisterInput {
  email: string;
  password: string;
  fullName?: string;
  role?: 'admin' | 'manager' | 'office' | 'front_desk' | 'staff' | 'band_room';
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  userId: string;
  email: string | null;
  fullName: string | null;
  role: string;
}

/**
 * Register a new user
 */
export async function registerUser(input: RegisterInput): Promise<AuthUser> {
  const { email, password, fullName, role = 'staff' } = input;

  // Check if user already exists
  const existing = await prisma.profile.findFirst({
    where: { email: email.toLowerCase() },
  });

  if (existing) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  // Generate unique userId (UUID)
  const userId = crypto.randomUUID();

  // Create profile
  const profile = await prisma.profile.create({
    data: {
      userId,
      email: email.toLowerCase(),
      fullName,
    },
  });

  // Create user role
  await prisma.userRole.create({
    data: {
      userId,
      role,
    },
  });

  // Store password hash
  await prisma.userCredential.create({
    data: {
      userId,
      passwordHash,
    },
  });

  console.log('[Auth] User registered:', email, 'as', role);

  return {
    id: profile.id,
    userId: profile.userId,
    email: profile.email,
    fullName: profile.fullName,
    role,
  };
}

/**
 * Authenticate user and return user data
 */
export async function authenticateUser(input: LoginInput): Promise<AuthUser | null> {
  const { email, password } = input;

  // Get user profile
  const profile = await prisma.profile.findFirst({
    where: { email: email.toLowerCase() },
    include: {
      userRole: true,
      userCredential: true,
    },
  });

  if (!profile || !profile.userRole || !profile.userCredential) {
    console.warn('[Auth] Login failed: User not found or incomplete:', email);
    return null;
  }

  // Verify password
  const isValid = await bcrypt.compare(password, profile.userCredential.passwordHash);

  if (!isValid) {
    console.warn('[Auth] Login failed: Invalid password:', email);
    return null;
  }

  console.log('[Auth] Login successful:', email, 'role:', profile.userRole.role);

  return {
    id: profile.id,
    userId: profile.userId,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.userRole.role,
  };
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<AuthUser | null> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    include: { userRole: true },
  });

  if (!profile || !profile.userRole) {
    return null;
  }

  return {
    id: profile.id,
    userId: profile.userId,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.userRole.role,
  };
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: { fullName?: string; email?: string }
): Promise<AuthUser> {
  const profile = await prisma.profile.update({
    where: { userId },
    data: {
      fullName: updates.fullName,
      email: updates.email?.toLowerCase(),
    },
    include: { userRole: true },
  });

  if (!profile.userRole) {
    throw new Error('User role not found');
  }

  return {
    id: profile.id,
    userId: profile.userId,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.userRole.role,
  };
}

/**
 * Change user password
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  // Get current credentials
  const credential = await prisma.userCredential.findUnique({
    where: { userId },
  });

  if (!credential) {
    throw new Error('User credentials not found');
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, credential.passwordHash);

  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, config.bcryptRounds);

  // Update password
  await prisma.userCredential.update({
    where: { userId },
    data: { passwordHash: newPasswordHash },
  });

  console.log('[Auth] Password changed for user:', userId);
}
