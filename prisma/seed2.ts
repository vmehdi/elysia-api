import { PrismaClient, Role, RuleType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with user2 and segmantaim.com domain...');

  // 1. Create the second user
  const user2PasswordHash = await Bun.password.hash('user2-password-456', {
    algorithm: "bcrypt",
    cost: Number(Bun.env.SALT_ROUNDS) || 10,
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'user2@segmentaim.com',
      passwordHash: user2PasswordHash,
      firstName: 'Ali',
      lastName: 'User2',
    },
  });
  console.log(`✅ Created user2: ${user2.email}`);

  // 2. Create organization for user2
  const org2 = await prisma.organization.create({
    data: { name: "Ali's Workspace", ownerId: user2.id },
  });
  console.log(`✅ Created Organization for user2: ${org2.name}`);

  // 3. Add user2 as OWNER
  await prisma.membership.create({
    data: { userId: user2.id, organizationId: org2.id, role: Role.OWNER },
  });
  console.log(`✅ Added user2 as OWNER of ${org2.name}`);

  // 4. Create segmantaim.com domain
  const domain2 = await prisma.domain.create({
    data: { name: 'Segmentaim Main', url: 'https://segmantaim.com', organizationId: org2.id },
  });
  console.log(`✅ Created Domain: ${domain2.name} with License Key: ${domain2.uniqueId}`);

  // 5. Add trackers
  const enabledTrackers2 = [
    'impression', 'dnd', 'keypress', 'heatmap', 'click-generic', 'click-rage', 'click-enrichment', 'page-load'
  ];
  const trackerData2 = enabledTrackers2.map(name => ({
    name,
    domainId: domain2.id,
  }));
  await prisma.domainTracker.createMany({ data: trackerData2 });
  console.log(`✅ Created ${trackerData2.length} enabled tracker settings for user2's domain.`);

  // 6. Add rules
  const clickRules2 = [
    { name: 'add_new_button_click', css_selector: '#dynamic button' },
    { name: 'shadow_dom_button_click', css_selector: 'button.shadow-target' },
    { name: 'counter_button_click', css_selector: '#counter' },
    { name: 'product_button', regex_selector: { attribute: 'data-product-id', pattern: '^prod-[0-9]+$' } }
  ];
  const impressionRules2 = [
    { name: 'promo_banner_view_css', css_selector: '[data-impression="promo-banner"]' },
    { name: 'main_content_view_css', css_selector: 'main' },
    { name: 'product_link_view_regex', regex_selector: { attribute: 'href', pattern: 'product' } }
  ];
  const ruleData2 = [
    ...clickRules2.map(rule => ({
      name: rule.name,
      type: RuleType.click,
      css_selector: rule.css_selector,
      regex_attribute: rule.regex_selector?.attribute,
      regex_pattern: rule.regex_selector?.pattern,
      domainId: domain2.id
    })),
    ...impressionRules2.map(rule => ({
      name: rule.name,
      type: RuleType.impression,
      css_selector: rule.css_selector,
      regex_attribute: rule.regex_selector?.attribute,
      regex_pattern: rule.regex_selector?.pattern,
      domainId: domain2.id
    }))
  ];
  await prisma.domainRule.createMany({ data: ruleData2 });
  console.log(`✅ Created ${ruleData2.length} enrichment rules for user2's domain.`);

  console.log('Seeding for user2 and segmantaim.com finished successfully! 🎉');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 