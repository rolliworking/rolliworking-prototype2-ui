// Auth Routes - Login, Register, Profile
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { registerUser, authenticateUser, getUserById, updateUserProfile, changePassword } from './service';
import { authenticateJWT } from '../../middleware/auth';
import { config } from '../../config';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().optional(),
  role: z.enum(['admin', 'manager', 'office', 'front_desk', 'staff', 'band_room']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const updateProfileSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().email().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

export default async function authRoutes(server: FastifyInstance) {
  /**
   * POST /api/auth/register
   * Register a new user
   */
  server.post('/register', async (request, reply) => {
    try {
      const data = registerSchema.parse(request.body);

      const user = await registerUser(data);

      // Generate JWT token
      const token = server.jwt.sign({
        userId: user.userId,
        email: user.email,
        role: user.role,
      }, {
        expiresIn: config.jwtExpiresIn,
      });

      return reply.status(201).send({
        success: true,
        user: {
          id: user.userId,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        token,
      });
    } catch (error: any) {
      if (error.message === 'User with this email already exists') {
        return reply.status(409).send({ error: error.message });
      }
      console.error('[Auth] Register error:', error);
      return reply.status(500).send({ error: 'Registration failed' });
    }
  });

  /**
   * POST /api/auth/login
   * Authenticate user and return JWT token
   */
  server.post('/login', async (request, reply) => {
    try {
      const data = loginSchema.parse(request.body);

      const user = await authenticateUser(data);

      if (!user) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      // Generate JWT token
      const token = server.jwt.sign({
        userId: user.userId,
        email: user.email,
        role: user.role,
      }, {
        expiresIn: config.jwtExpiresIn,
      });

      return reply.send({
        success: true,
        user: {
          id: user.userId,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        token,
      });
    } catch (error: any) {
      console.error('[Auth] Login error:', error);
      return reply.status(500).send({ error: 'Login failed' });
    }
  });

  /**
   * GET /api/auth/me
   * Get current user profile (requires authentication)
   */
  server.get('/me', { preHandler: [authenticateJWT] }, async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const user = await getUserById(userId);

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send({
        success: true,
        user: {
          id: user.userId,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      });
    } catch (error: any) {
      console.error('[Auth] Get profile error:', error);
      return reply.status(500).send({ error: 'Failed to get profile' });
    }
  });

  /**
   * PUT /api/auth/profile
   * Update current user profile (requires authentication)
   */
  server.put('/profile', { preHandler: [authenticateJWT] }, async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId;
      const updates = updateProfileSchema.parse(request.body);

      const user = await updateUserProfile(userId, updates);

      return reply.send({
        success: true,
        user: {
          id: user.userId,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      });
    } catch (error: any) {
      console.error('[Auth] Update profile error:', error);
      return reply.status(500).send({ error: 'Failed to update profile' });
    }
  });

  /**
   * POST /api/auth/logout
   * Logout user (client-side token removal, server doesn't track sessions)
   */
  server.post('/logout', { preHandler: [authenticateJWT] }, async (request, reply) => {
    // In a JWT-based system, logout is handled client-side by removing the token
    // For advanced use cases, implement token blacklisting here
    return reply.send({ success: true, message: 'Logged out successfully' });
  });

  /**
   * POST /api/auth/change-password
   * Change user password (requires authentication)
   */
  server.post('/change-password', { preHandler: [authenticateJWT] }, async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId;
      const data = changePasswordSchema.parse(request.body);

      await changePassword(userId, data.currentPassword, data.newPassword);

      return reply.send({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error: any) {
      if (error.message === 'Current password is incorrect') {
        return reply.status(400).send({ error: error.message });
      }
      console.error('[Auth] Change password error:', error);
      return reply.status(500).send({ error: 'Failed to change password' });
    }
  });
}
