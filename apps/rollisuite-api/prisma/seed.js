const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting minimal database seed...');

  // Clean existing data
  console.log('Cleaning existing data...');
  try {
    await prisma.soLine.deleteMany();
    await prisma.salesOrder.deleteMany();
    await prisma.jobActivityLog.deleteMany();
    await prisma.jobStatusHistory.deleteMany();
    await prisma.job.deleteMany();
    await prisma.estimateLineItem.deleteMany();
    await prisma.estimate.deleteMany();
    await prisma.watch.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.dailyHitList.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.userCredential.deleteMany();
    await prisma.profile.deleteMany();
  } catch (e) {
    console.log('Cleanup error (may be expected):', e.message);
  }
  console.log('✓ Cleaned existing data');

  // 1. Create Admin User
  console.log('Creating admin user...');
  const adminProfile = await prisma.profile.create({
    data: {
      userId: 'admin-001',
      fullName: 'Admin User',
      email: 'admin@rollisuite.com',
    },
  });

  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.userCredential.create({
    data: {
      userId: adminProfile.userId,
      passwordHash: hashedPassword,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: adminProfile.userId,
      role: 'admin',
    },
  });
  console.log('✓ Admin: admin@rollisuite.com / admin123');

  // 2. Create Customers
  console.log('Creating customers...');
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        firstName: 'John',
        lastName: 'Smith',
        displayName: 'John Smith',
        email: 'john.smith@example.com',
        phone: '555-0101',
        emailNormalized: 'john.smith@example.com',
        phoneNormalized: '5550101',
      },
    }),
    prisma.customer.create({
      data: {
        firstName: 'Sarah',
        lastName: 'Johnson',
        displayName: 'Sarah Johnson',
        email: 'sarah.johnson@example.com',
        phone: '555-0102',
        isShipDirect: true,
        emailNormalized: 'sarah.johnson@example.com',
        phoneNormalized: '5550102',
      },
    }),
    prisma.customer.create({
      data: {
        companyName: 'Watch Corporation',
        displayName: 'Watch Corporation',
        firstName: 'Michael',
        lastName: 'Chen',
        email: 'michael.chen@watchcorp.com',
        phone: '555-0103',
        isTradePricing: true,
        emailNormalized: 'michael.chen@watchcorp.com',
        phoneNormalized: '5550103',
      },
    }),
  ]);
  console.log('✓ Created 3 customers');

  // 3. Create Watches
  console.log('Creating watches...');
  const watches = await Promise.all([
    prisma.watch.create({
      data: {
        brand: 'Rolex',
        model: 'Submariner',
        serialNumber: 'R123456',
        referenceNumber: '116610LN',
        customerId: customers[0].id,
      },
    }),
    prisma.watch.create({
      data: {
        brand: 'Omega',
        model: 'Speedmaster',
        serialNumber: 'O789012',
        referenceNumber: '310.30.42.50.01.001',
        customerId: customers[1].id,
      },
    }),
    prisma.watch.create({
      data: {
        brand: 'Tag Heuer',
        model: 'Carrera',
        serialNumber: 'T345678',
        referenceNumber: 'CBN2A1A.BA0643',
        customerId: customers[2].id,
      },
    }),
  ]);
  console.log('✓ Created 3 watches');

  // 4. Create Estimates (without line items for simplicity)
  console.log('Creating estimates...');
  const estimates = await Promise.all([
    prisma.estimate.create({
      data: {
        estimateNumber: 'EST-2024-001',
        customerId: customers[0].id,
        status: 'draft',
        serviceType: 'repair',
        totalAmount: 550.00,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.estimate.create({
      data: {
        estimateNumber: 'EST-2024-002',
        customerId: customers[1].id,
        status: 'sent',
        serviceType: 'restoration',
        totalAmount: 1320.00,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(),
      },
    }),
    prisma.estimate.create({
      data: {
        estimateNumber: 'EST-2024-003',
        customerId: customers[2].id,
        status: 'approved',
        serviceType: 'appraisal',
        totalAmount: 275.00,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);
  console.log('✓ Created 3 estimates');

  // 5. Create Jobs
  console.log('Creating jobs...');
  const jobs = await Promise.all([
    prisma.job.create({
      data: {
        jobId: 'JOB-2024-001',
        customerId: customers[0].id,
        watchId: watches[0].id,
        estimateNumber: estimates[0].estimateNumber,
        status: 'in_service',
        priority: 'high',
        createdBy: adminProfile.userId,
      },
    }),
    prisma.job.create({
      data: {
        jobId: 'JOB-2024-002',
        customerId: customers[1].id,
        watchId: watches[1].id,
        estimateNumber: estimates[1].estimateNumber,
        status: 'awaiting_customer_approval',
        priority: 'normal',
        createdBy: adminProfile.userId,
      },
    }),
    prisma.job.create({
      data: {
        jobId: 'JOB-2024-003',
        customerId: customers[2].id,
        watchId: watches[2].id,
        status: 'intake',
        priority: 'urgent',
        createdBy: adminProfile.userId,
      },
    }),
  ]);
  console.log('✓ Created 3 jobs');

  // 6. Create Sales Orders
  console.log('Creating sales orders...');
  await Promise.all([
    prisma.salesOrder.create({
      data: {
        soNumber: 'SO-2024-001',
        customerId: customers[2].id,
        status: 'pending',
        subtotal: 250.00,
        totalAmount: 275.00,
        tcAgreed: true,
        tcAgreedAt: new Date(),
      },
    }),
    prisma.salesOrder.create({
      data: {
        soNumber: 'SO-2024-002',
        customerId: customers[0].id,
        status: 'draft',
        subtotal: 500.00,
        totalAmount: 550.00,
      },
    }),
  ]);
  console.log('✓ Created 2 sales orders');

  // 7. Create Daily Hit List
  console.log('Creating daily hit list...');
  await prisma.dailyHitList.create({
    data: {
      date: new Date(),
      items: [
        {
          id: jobs[0].id,
          jobNumber: 'JOB-2024-001',
          customer: 'John Smith',
          watch: 'Rolex Submariner',
          priority: 'high',
          status: 'in_service',
        },
        {
          id: jobs[2].id,
          jobNumber: 'JOB-2024-003',
          customer: 'Michael Chen',
          watch: 'Tag Heuer Carrera',
          priority: 'urgent',
          status: 'intake',
        },
      ],
      metadata: {
        totalJobs: 2,
        urgentCount: 1,
        highPriorityCount: 1,
      },
    },
  });
  console.log('✓ Created daily hit list');

  console.log('\n🎉 Database seed complete!');
  console.log('\n📊 Summary:');
  console.log('- Admin: admin@rollisuite.com / admin123');
  console.log('- 3 customers');
  console.log('- 3 watches');
  console.log('- 3 estimates (draft, sent, approved)');
  console.log('- 3 jobs (intake, in_service, awaiting_customer_approval)');
  console.log('- 2 sales orders');
  console.log('- 1 daily hit list');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
