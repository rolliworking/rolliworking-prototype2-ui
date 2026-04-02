import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'inspection-photos');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const QuerySchema = z.object({
  watchId: z.string().optional(),
  jobId: z.string().optional(),
  customerId: z.string().optional(),
  photoType: z.string().optional(),
});

export async function inspectionPhotosRoutes(server: FastifyInstance) {
  /**
   * POST /api/v1/inspection-photos/upload
   * Upload inspection photo
   */
  server.post('/upload', async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'No file uploaded',
        });
      }

      // Get metadata from fields
      const watchId = data.fields.watchId?.value as string | undefined;
      const jobId = data.fields.jobId?.value as string | undefined;
      const customerId = data.fields.customerId?.value as string | undefined;
      const photoType = (data.fields.photoType?.value as string) || 'intake';
      const description = data.fields.description?.value as string | undefined;

      // Generate unique filename
      const fileExt = path.extname(data.filename);
      const uniqueFileName = `${randomUUID()}${fileExt}`;
      const filePath = path.join(UPLOAD_DIR, uniqueFileName);

      // Save file
      await pipeline(data.file, fs.createWriteStream(filePath));

      // Get file stats
      const stats = fs.statSync(filePath);

      // Save to database
      const photo = await prisma.inspectionPhoto.create({
        data: {
          watchId,
          jobId,
          customerId,
          fileName: data.filename,
          filePath: `/uploads/inspection-photos/${uniqueFileName}`,
          fileSize: stats.size,
          mimeType: data.mimetype,
          photoType: photoType as any,
          description,
        },
        include: {
          watch: {
            select: {
              id: true,
              brand: true,
              model: true,
            },
          },
          job: {
            select: {
              id: true,
              jobId: true,
            },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return reply.status(201).send({
        success: true,
        data: photo,
        message: 'Photo uploaded successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to upload photo',
      });
    }
  });

  /**
   * GET /api/v1/inspection-photos
   * Get inspection photos with filters
   */
  server.get('/', async (request, reply) => {
    const query = QuerySchema.parse(request.query);

    const where: any = {};
    if (query.watchId) where.watchId = query.watchId;
    if (query.jobId) where.jobId = query.jobId;
    if (query.customerId) where.customerId = query.customerId;
    if (query.photoType) where.photoType = query.photoType;

    try {
      const photos = await prisma.inspectionPhoto.findMany({
        where,
        include: {
          watch: {
            select: {
              id: true,
              brand: true,
              model: true,
            },
          },
          job: {
            select: {
              id: true,
              jobId: true,
            },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.status(200).send({
        success: true,
        data: photos,
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to fetch photos',
      });
    }
  });

  /**
   * GET /api/v1/inspection-photos/:id
   * Get single photo
   */
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const photo = await prisma.inspectionPhoto.findUnique({
        where: { id },
        include: {
          watch: true,
          job: true,
          customer: true,
        },
      });

      if (!photo) {
        return reply.status(404).send({
          success: false,
          error: 'Photo not found',
        });
      }

      return reply.status(200).send({
        success: true,
        data: photo,
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to fetch photo',
      });
    }
  });

  /**
   * DELETE /api/v1/inspection-photos/:id
   * Delete photo
   */
  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const photo = await prisma.inspectionPhoto.findUnique({
        where: { id },
      });

      if (!photo) {
        return reply.status(404).send({
          success: false,
          error: 'Photo not found',
        });
      }

      // Delete file from filesystem
      const fullPath = path.join(process.cwd(), photo.filePath.replace(/^\//, ''));
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      // Delete from database
      await prisma.inspectionPhoto.delete({
        where: { id },
      });

      return reply.status(200).send({
        success: true,
        message: 'Photo deleted successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to delete photo',
      });
    }
  });

  /**
   * PATCH /api/v1/inspection-photos/:id
   * Update photo metadata
   */
  server.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { description, photoType } = request.body as {
      description?: string;
      photoType?: string;
    };

    try {
      const photo = await prisma.inspectionPhoto.update({
        where: { id },
        data: {
          description,
          photoType: photoType as any,
        },
      });

      return reply.status(200).send({
        success: true,
        data: photo,
        message: 'Photo updated successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to update photo',
      });
    }
  });
}
