// Jobs Service Layer with RolliWorking Integration
import { prisma } from '../../db/client';
import { Prisma, JobStatus, PriorityLevel } from '@prisma/client';
import type { JobStatus as ContractJobStatus } from '@rollisuite/integration-contracts';

interface CreateJobInput {
  estimateNumber?: string;
  customerId: string;
  watchId: string;
  status?: JobStatus;
  priority?: PriorityLevel;
  dueDate?: Date;
  intakeNotes?: string;
  conditionNotes?: string;
  assignedTo?: string;
}

interface UpdateJobInput {
  status?: JobStatus;
  priority?: PriorityLevel;
  dueDate?: Date;
  intakeNotes?: string;
  conditionNotes?: string;
  assignedTo?: string;
}

/**
 * Generate next job ID (format: J-XXXXXX)
 */
async function getNextJobId(): Promise<string> {
  const latest = await prisma.job.findFirst({
    orderBy: { jobId: 'desc' },
    select: { jobId: true },
  });

  let nextNumber = 1;
  if (latest) {
    const match = latest.jobId.match(/J-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `J-${String(nextNumber).padStart(6, '0')}`;
}

/**
 * Map Prisma JobStatus to Contract JobStatus
 */
function mapJobStatus(status: JobStatus): ContractJobStatus {
  const statusMap: Record<JobStatus, ContractJobStatus> = {
    intake: 'intake',
    in_review: 'in_review',
    awaiting_customer_approval: 'awaiting_customer_approval',
    approved: 'approved',
    in_service: 'in_service',
    testing: 'testing',
    ready_to_ship: 'ready_to_ship',
    closed: 'closed',
  };

  return statusMap[status] || 'intake';
}

/**
 * Create job
 */
export async function createJob(data: CreateJobInput) {
  const jobId = await getNextJobId();

  const job = await prisma.job.create({
    data: {
      jobId,
      estimateNumber: data.estimateNumber,
      customerId: data.customerId,
      watchId: data.watchId,
      status: data.status || 'intake',
      priority: data.priority || 'normal',
      dueDate: data.dueDate,
      intakeNotes: data.intakeNotes,
      conditionNotes: data.conditionNotes,
      assignedTo: data.assignedTo,
      createdBy: data.assignedTo, // TODO: Get from auth context
    },
    include: {
      customer: true,
      watch: true,
      assignee: true,
    },
  });

  // Log initial status
  await prisma.jobStatusHistory.create({
    data: {
      jobId: job.id,
      toStatus: job.status,
      changedBy: data.assignedTo,
      notes: 'Job created',
    },
  });

  console.log('[Job] Created:', job.jobId);
  return job;
}

/**
 * Get job by ID
 */
export async function getJob(id: string) {
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      customer: true,
      watch: true,
      creator: true,
      assignee: true,
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
      activityLog: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      timingTests: {
        orderBy: { createdAt: 'desc' },
      },
      pressureTests: {
        orderBy: { createdAt: 'desc' },
      },
      salesOrders: true,
    },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  return job;
}

/**
 * Update job
 */
export async function updateJob(id: string, data: UpdateJobInput, updatedBy?: string) {
  const currentJob = await prisma.job.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!currentJob) {
    throw new Error('Job not found');
  }

  const job = await prisma.job.update({
    where: { id },
    data: {
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate,
      intakeNotes: data.intakeNotes,
      conditionNotes: data.conditionNotes,
      assignedTo: data.assignedTo,
    },
    include: {
      customer: true,
      watch: true,
      assignee: true,
    },
  });

  // Log status change
  if (data.status && data.status !== currentJob.status) {
    await prisma.jobStatusHistory.create({
      data: {
        jobId: id,
        fromStatus: currentJob.status,
        toStatus: data.status,
        changedBy: updatedBy,
        notes: `Status changed from ${currentJob.status} to ${data.status}`,
      },
    });
  }

  console.log('[Job] Updated:', job.jobId);
  return job;
}

/**
 * Delete job
 */
export async function deleteJob(id: string) {
  await prisma.job.delete({ where: { id } });
  console.log('[Job] Deleted:', id);
}

/**
 * Search jobs
 */
export async function searchJobs(filters: {
  customerId?: string;
  status?: JobStatus;
  assignedTo?: string;
  search?: string;
  page?: number;
  perPage?: number;
}) {
  const { customerId, status, assignedTo, search, page = 1, perPage = 50 } = filters;

  const where: Prisma.JobWhereInput = {};

  if (customerId) where.customerId = customerId;
  if (status) where.status = status;
  if (assignedTo) where.assignedTo = assignedTo;

  if (search) {
    where.OR = [
      { jobId: { contains: search, mode: 'insensitive' } },
      { estimateNumber: { contains: search, mode: 'insensitive' } },
      { intakeNotes: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      include: {
        customer: true,
        watch: true,
        assignee: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.job.count({ where }),
  ]);

  return {
    jobs,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Assign job to watchmaker
 */
export async function assignJob(
  id: string,
  watchmakerId: string,
  assignedBy?: string
) {
  const job = await prisma.job.update({
    where: { id },
    data: {
      assignedTo: watchmakerId,
      status: 'approved', // Move to approved when assigned
    },
    include: {
      customer: true,
      watch: true,
      assignee: true,
    },
  });

  // Log assignment
  await prisma.jobActivityLog.create({
    data: {
      jobId: id,
      userId: assignedBy || watchmakerId,
      action: 'assigned',
      details: `Assigned to watchmaker: ${watchmakerId}`,
    },
  });

  console.log('[Job] Assigned:', job.jobId, 'to', watchmakerId);
  return job;
}

/**
 * Update job status from RolliWorking webhook
 * Uses integration contracts
 */
export async function updateJobStatusFromWebhook(
  jobId: string,
  newStatus: ContractJobStatus,
  updatedBy?: string,
  notes?: string
) {
  // Map contract status to Prisma enum
  const prismaStatus: JobStatus = newStatus as JobStatus;

  const job = await updateJob(
    jobId,
    { status: prismaStatus },
    updatedBy
  );

  if (notes) {
    await prisma.jobActivityLog.create({
      data: {
        jobId,
        userId: updatedBy || 'system',
        action: 'status_update',
        details: notes,
      },
    });
  }

  return job;
}
