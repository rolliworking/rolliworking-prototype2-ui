import { FastifyRequest, FastifyReply } from 'fastify';

// JWT authentication middleware
export async function authenticateJWT(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

// Role-based access control middleware
export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Implement role checking
    // 1. Get user from JWT payload
    // 2. Query user_roles table
    // 3. Check if user has required role
    // 4. Return 403 if not authorized
  };
}

// Permission-based access control
export function requirePermission(permissionKey: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Implement permission checking
    // 1. Get user role
    // 2. Check role_permissions table (with fallback to defaults)
    // 3. Return 403 if not authorized
  };
}

// IP verification middleware
export async function verifyIP(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // TODO: Implement IP verification
  // 1. Get user role
  // 2. If admin, skip check
  // 3. Else, verify IP is in ALLOWED_OFFICE_IPS
  // 4. Return 403 if not from office
}
