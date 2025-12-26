const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Проверяем есть ли dev-mock пользователь
  let user = await p.user.findFirst({ where: { telegramId: 'dev-mock' } });
  
  if (user) {
    console.log('User already exists:', user.id, user.username);
    return;
  }
  
  console.log('Creating dev-mock user...');
  user = await p.user.create({
    data: {
      telegramId: 'dev-mock',
      username: 'dev_user',
      firstName: 'Developer',
      lastName: 'Mode',
      xp: 1000,
      status: 'ONLINE',
      lastSeenAt: new Date(),
      profilePublic: true,
      showActivity: true,
      showOnlineStatus: true,
    }
  });
  console.log('Created user:', user.id);
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());

