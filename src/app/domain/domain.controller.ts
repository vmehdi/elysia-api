import { prisma } from '@/utils/prisma';
import { RuleType } from '@prisma/client';

/**
 * Creates a new domain along with a default set of trackers and enrichment rules.
 * This entire operation is wrapped in a transaction to ensure data integrity.
 */
export const createDomainWithDefaults = async ({ body, user, set }: any) => {
  // 'user' object is available here because this controller will be used
  // behind the 'isAuthenticated' middleware.

  const { name, url, organizationId } = body;

  // TODO: Add a check here to ensure the authenticated user has permission
  // to add a domain to this specific organizationId.

  try {
    // Use a Prisma transaction to ensure all operations succeed or none do.
    const newDomain = await prisma.$transaction(async (tx) => {
      // 1. Create the new Domain
      const domain = await tx.domain.create({
        data: {
          name,
          url,
          organizationId,
        },
      });

      // 2. Create the default enabled trackers for this domain
      const enabledTrackers = [
        'pageLoad', 'click-enrichment', 'click-rage', 
        'click-generic', 'impression', 'heatmap', 'dnd', 'keypress'
      ];
      const trackerData = enabledTrackers.map(tName => ({
        name: tName,
        domainId: domain.id,
      }));
      await tx.domainTracker.createMany({ data: trackerData });

      // 3. Create the default enrichment rules for this domain
      const clickRules = [
        { name: 'add_new_button_click', css_selector: '#dynamic button' },
        { name: 'shadow_dom_button_click', css_selector: 'button.shadow-target' },
      ];
      const impressionRules = [
        { name: 'promo_banner_view_css', css_selector: '[data-impression="promo-banner"]' },
      ];

      const ruleData = [
        ...clickRules.map(rule => ({ ...rule, type: RuleType.click, domainId: domain.id })),
        ...impressionRules.map(rule => ({ ...rule, type: RuleType.impression, domainId: domain.id }))
      ];
      await tx.domainRule.createMany({ data: ruleData });

      return domain;
    });

    return {
      success: true,
      message: 'Domain created successfully with default settings.',
      data: newDomain,
    };

  } catch (error) {
    console.error("🚨 Error creating domain with defaults:", error);
    set.status = 500;
    return { success: false, error: 'Failed to create domain.' };
  }
};