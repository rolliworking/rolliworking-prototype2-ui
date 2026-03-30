import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db/client';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      userId: string;
      role: string;
    };
  }
}

// JWT authentication middleware
export async function authenticateJWT(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
    // JWT payload should include userId
    const payload = request.user as any;
    request.user = payload;
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

// Role-based access control middleware
export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      // Get user role from database
      const userRole = await prisma.userRole.findUnique({
        where: { userId: request.user.userId },
      });

      if (!userRole || !allowedRoles.includes(userRole.role)) {
        return reply.status(403).send({ error: 'Forbidden: Insufficient permissions' });
      }

      // Attach role to request for later use
      request.user.role = userRole.role;
    } catch (error) {
      console.error('Role check error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  };
}

// Permission-based access control
export function requirePermission(permissionKey: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      // Get user role
      const userRole = await prisma.userRole.findUnique({
        where: { userId: request.user.userId },
      });

      if (!userRole) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      // Check role_permissions table for override
      const permission = await prisma.rolePermission.findFirst({
        where: {
          role: userRole.role as any,
          permissionKey,
        },
      });

      // If permission exists and is disabled, deny
      if (permission && !permission.enabled) {
        return reply.status(403).send({ error: 'Forbidden: Permission denied' });
      }

      // Otherwise allow (default permissions or enabled override)
    } catch (error) {
      console.error('Permission check error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  };
}

// IP verification middleware
export async function verifyIP(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (!request.user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  try {
    // Get user role
    const userRole = await prisma.userRole.findUnique({
      where: { userId: request.user.userId },
    });

    // Admins can access from anywhere
    if (userRole?.role === 'admin') {
      return;
    }

    // Get client IP
    const clientIp = request.ip;

    // Check if IP is in allowed list
    const allowedIps = process.env.ALLOWED_OFFICE_IPS?.split(',') || [];

    if (!allowedIps.some(allowedIp => {
      // Simple IP matching (can be enhanced with CIDR support)
      return clientIp.includes(allowedIp) || allowedIp === '0.0.0.0';
    })) {
      return reply.status(403).send({ error: 'Forbidden: Access from this IP is not allowed' });
    }
  } catch (error) {
    console.error('IP verification error:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
}
