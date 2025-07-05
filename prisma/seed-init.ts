// File seed2.ts has been deleted and is no longer present.


import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with super admin user...');

  const superAdminPasswordHash = await Bun.password.hash('admin10203040', {
    algorithm: "bcrypt",
    cost: Number(Bun.env.SALT_ROUNDS) || 10,
  });

  const user = await prisma.user.create({
    data: {
      email: 'mh.vaezi@gmail.com',
      passwordHash: superAdminPasswordHash,
      firstName: 'Super',
      lastName: 'Admin',
    },
  });
  console.log(`✅ Created super admin user: ${user.email}`);

  const org = await prisma.organization.create({
    data: { name: "Demo Org", ownerId: user.id },
  });

  await prisma.membership.create({
    data: { userId: user.id, organizationId: org.id, role: Role.OWNER },
  });


  console.log('Seeding completed successfully! 🎉');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });