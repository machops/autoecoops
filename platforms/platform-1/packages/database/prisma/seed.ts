import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Clean database
  await prisma.user.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.contractAnalysis.deleteMany();
  await prisma.usageRecord.deleteMany();
  await prisma.notification.deleteMany();

  // Create demo user
  const passwordHash = 'hashed_password';
  
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@contracts-l1.com',
      name: 'Demo User',
      password: passwordHash,
      company: 'Demo Company',
      monthlyQuota: 100,
      usedQuota: 15,
      emailVerified: true
    }
  });

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@contracts-l1.com',
      name: 'Admin User',
      password: passwordHash,
      company: 'Contracts-L1 Team',
      monthlyQuota: 1000,
      usedQuota: 0,
      emailVerified: true
    }
  });

  console.log('Created users:', demoUser.id, adminUser.id);

  // Create sample contract
  const contract = await prisma.contract.create({
    data: {
      userId: demoUser.id,
      originalFileName: 'sample.pdf',
      fileSize: 245678,
      mimeType: 'application/pdf',
      status: 'COMPLETED'
    }
  });

  console.log('Created contract:', contract.id);

  // Create analysis
  await prisma.contractAnalysis.create({
    data: {
      contractId: contract.id,
      overallRiskLevel: 'MEDIUM',
      confidence: 85,
      summary: 'Sample contract analysis.',
      keyFindings: ['No issues found'],
      recommendations: ['Review carefully']
    }
  });

  console.log('Created analysis');

<<<<<<< HEAD
  console.log(`✅ 創建了 2 個分析結果`);

  // 創建使用量記錄
  console.log('📊 創建使用量記錄...');
  
  await prisma.usageRecord.createMany({
    data: [
      {
        userId: demoUser.id,
        type: 'CONTRACT_UPLOAD',
        contractId: contract1.id,
        apiCalls: 1
      },
      {
        userId: demoUser.id,
        type: 'AI_ANALYSIS',
        contractId: contract1.id,
        tokensUsed: 2450,
        costUsd: 0.0049
      },
      {
        userId: demoUser.id,
        type: 'SEMANTIC_SEARCH',
        apiCalls: 3
      }
    ]
  });

  console.log(`✅ 創建了使用量記錄`);

  // 創建通知
  console.log('🔔 創建通知...');
  
  await prisma.notification.createMany({
    data: [
      {
        userId: demoUser.id,
        type: 'ANALYSIS_COMPLETE',
        title: '契約分析完成',
        message: 'sample-nda.pdf 的分析已完成,整體風險等級為中等。',
        link: `/contracts/${contract1.id}`
      },
      {
        userId: demoUser.id,
        type: 'QUOTA_WARNING',
        title: '配額提醒',
        message: '您已使用本月 15% 的配額。',
        read: false
      }
    ]
  });

  console.log(`✅ 創建了通知`);

  console.log(`
🎉 測試數據播種完成!`);
  console.log(`
登入資訊:`);
  console.log(`  Demo 用戶: demo@contracts-l1.com / password123`);
  console.log(`  Admin 用戶: admin@contracts-l1.com / password123`);
=======
  console.log('Seed completed successfully!');
  console.log('Demo user: demo@contracts-l1.com / password123');
  console.log('Admin user: admin@contracts-l1.com / password123');
>>>>>>> 2af6d5c (feat: 完成依賴安裝、建置和開發環境測試)
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });