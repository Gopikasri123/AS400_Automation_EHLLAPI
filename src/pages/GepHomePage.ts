import { Locator } from '@playwright/test';
import { BasePage } from '../core/BasePage';

/** Landing page: opening the site and the UK Medical/Dental domain picker. The header is GepHeader. */
export class GepHomePage extends BasePage {
  // Tosca: Domain Check for Genx-UK. Only these domains need "Browse" to be selected.
  private static readonly UK_BROWSE_DOMAINS = ['Medical', 'Dental'];

  // Tosca: SignIn > Select Browse > Browse   | "Browse" link on the "<country> <domain>" card of the domain picker
  private domainSelectorBrowseLink(country: string, domain: string): Locator {
    return this.page
      .locator('div.newdomain')
      .filter({ has: this.page.getByText(`${country} ${domain}`, { exact: true }) })
      .locator('a[data-test-id^="selectDomain.BrowseText"]');
  }

  /** Tosca: Precondition-Launch the HS Website. */
  async open(url: string): Promise<void> {
    await this.openUrl(url);
  }

  /** Tosca: Domain Check for Genx-UK. Click Browse on the matching UK Medical/Dental card. */
  async selectDomainIfRequired(country: string, domain: string): Promise<void> {
    if (country !== 'UK' || !GepHomePage.UK_BROWSE_DOMAINS.includes(domain)) return;
    await this.clickIfVisible(this.domainSelectorBrowseLink(country, domain), 30000);
  }
}
