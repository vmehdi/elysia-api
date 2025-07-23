import { PrismaClient, Role, RuleType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with sample customer and full tracker setup...');

  // 1. Create the customer user
  const passwordHash = await Bun.password.hash('customer-password-123', {
    algorithm: "bcrypt",
    cost: Number(Bun.env.SALT_ROUNDS) || 10,
  });

  const user = await prisma.user.create({
    data: {
      email: 'customer@segmentaim.com',
      passwordHash,
      firstName: 'Customer',
      lastName: 'User'
    },
  });
  console.log(`✅ Created customer user: ${user.email}`);

  // 2. Create organization and membership
  const organization = await prisma.organization.create({
    data: { name: "Customer's Workspace", ownerId: user.id },
  });
  await prisma.customer.create({ data: { organizationId: organization.id } });
  await prisma.membership.create({
    data: { userId: user.id, organizationId: organization.id, role: Role.OWNER },
  });
  console.log(`✅ Created organization and membership`);

  // 3. Create domain
  const domain = await prisma.domain.create({
    data: {
      name: 'My Full Tracker Website',
      url: 'https://demo.segmentaim.com/v5/',
      organizationId: organization.id,
      trackerVersion: '0.1.3',
    },
  });
  console.log(`✅ Created domain: ${domain.name} with license: ${domain.uniqueId}`);

  // 4. Enable full trackers
  const trackers = [
    'impression',
    'dnd',
    'click',
    'keypress',
    'heatmap',
    'recording',
    'pageload'
  ];

  const stable = ['data-seg-id', 'data-product-id'];
  await prisma.domainTracker.createMany({
    data: trackers.map(name => ({ name, domainId: domain.id }))
  });
  console.log(`✅ Enabled ${trackers.length} trackers`);

  // 5. Add rules
  const clickRules = [
    { name: 'add_new_button_click', css_selector: '#dynamic button' },
    { name: 'nav_clicks', css_selector: '.test-link' },
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
      type: RuleType.tc,
      css_selector: rule.css_selector,
      regex_attribute: rule.regex_selector?.attribute,
      regex_pattern: rule.regex_selector?.pattern,
      domainId: domain.id
    })),
    ...impressionRules.map(rule => ({
      name: rule.name,
      type: RuleType.ti,
      css_selector: rule.css_selector,
      regex_attribute: rule.regex_selector?.attribute,
      regex_pattern: rule.regex_selector?.pattern,
      domainId: domain.id
    }))
  ];

  await prisma.domainRule.createMany({ data: ruleData });
  console.log(`✅ Created ${ruleData.length} enrichment rules`);

  console.log('✅ Seeding complete 🎉');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });