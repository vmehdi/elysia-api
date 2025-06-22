import { PrismaClient, Role, RuleType } from '@prisma/client';
// Bun's built-in password hashing is used
// No need to import bcrypt

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with Super Admin and initial records...');

  // 1. Create the Super Admin User
  const passwordHash = await Bun.password.hash('super-secret-password-123', {
    algorithm: "bcrypt",
    cost: Number(Bun.env.SALT_ROUNDS) || 10,
  });

  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@segmentaim.com',
      passwordHash: passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
    },
  });
  console.log(`✅ Created Super Admin user: ${superAdmin.email}`);

  // --- NEW: Create a Refresh Token and a Session for the Super Admin ---

  // 2. Create a sample Refresh Token for the admin
  await prisma.refreshToken.create({
    data: {
      userId: superAdmin.id,
      token: `${superAdmin.id}-${Date.now()}-refresh`, // Example token
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Expires in 30 days
    }
  });
  console.log(`✅ Created a Refresh Token for the Super Admin.`);

  // 3. Create a sample active Session for the admin
  await prisma.session.create({
    data: {
      userId: superAdmin.id,
      token: `${superAdmin.id}-${Date.now()}-session-jwt`, // Example session token
      userAgent: 'SeederScript/1.0',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // Expires in 1 day
    }
  });
  console.log(`✅ Created an active Session for the Super Admin.`);


  // --- The rest of the seeding process remains the same ---

  const organization = await prisma.organization.create({
    data: { name: "Admin's Workspace", ownerId: superAdmin.id },
  });
  console.log(`✅ Created Organization: ${organization.name}`);

  await prisma.customer.create({
    data: { organizationId: organization.id }
  });
  console.log(`✅ Created Customer record for organization: ${organization.name}`);

  await prisma.membership.create({
    data: { userId: superAdmin.id, organizationId: organization.id, role: Role.OWNER },
  });
  console.log(`✅ Added Super Admin as OWNER of ${organization.name}`);

  const domain = await prisma.domain.create({
    data: { name: 'My Test Website', url: 'http://localhost:5173', organizationId: organization.id },
  });
  console.log(`✅ Created Domain: ${domain.name} with License Key: ${domain.uniqueId}`);

  const enabledTrackers = [
    'impression', 'dnd', 'keypress', 'heatmap', 'click-generic', 'click-rage', 'click-enrichment', 'page-load'
  ];
  const trackerData = enabledTrackers.map(name => ({
    name,
    domainId: domain.id,
  }));
  await prisma.domainTracker.createMany({ data: trackerData });
  console.log(`✅ Created ${trackerData.length} enabled tracker settings for the domain.`);

  const clickRules = [
    { name: 'add_new_button_click', css_selector: '#dynamic button' },
    { name: 'shadow_dom_button_click', css_selector: 'button.shadow-target' },
    { name: 'counter_button_click', css_selector: '#counter' },
    { name: 'product_button', regex_selector: { attribute: 'data-product-id', pattern: '^prod-[0-9]+$' } }
  ];
  const impressionRules = [
    { name: 'promo_banner_view_css', css_selector: '[data-impression="promo-banner"]' },
    { name: 'main_content_view_css', css_selector: 'main' },
    { name: 'product_link_view_regex', regex_selector: { attribute: 'href', pattern: 'product' } }
  ];
  const ruleData = [
    ...clickRules.map(rule => ({
      name: rule.name,
      type: RuleType.click,
      css_selector: rule.css_selector,
      regex_attribute: rule.regex_selector?.attribute,
      regex_pattern: rule.regex_selector?.pattern,
      domainId: domain.id
    })),
    ...impressionRules.map(rule => ({
      name: rule.name,
      type: RuleType.impression,
      css_selector: rule.css_selector,
      regex_attribute: rule.regex_selector?.attribute,
      regex_pattern: rule.regex_selector?.pattern,
      domainId: domain.id
    }))
  ];
  await prisma.domainRule.createMany({ data: ruleData });
  console.log(`✅ Created ${ruleData.length} enrichment rules for the domain.`);

  console.log('Seeding finished successfully! 🎉');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });