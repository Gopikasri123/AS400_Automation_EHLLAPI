import { Locator } from '@playwright/test';
import { BasePage } from '../core/BasePage';

export class GepLoginPage extends BasePage {
  // Tosca: Enter Valid creditionals > Username
  private get loginUsernameInput(): Locator {
    return this.page.locator('[data-test-id="SignInUserNameInput"]');
  }

  // Tosca: Enter Valid creditionals > Password
  private get loginPasswordInput(): Locator {
    return this.page.locator('[data-test-id="SignInPasswordInput"]');
  }

  // Tosca: Login | SignIn Button > Sign In
  private get loginSignInButton(): Locator {
    return this.page.locator('[data-test-id="sign-in-button"]');
  }

  // Tosca: Click on the security question > Choose a security question*
  // Text-based and unverified: the UK Medical/Dental users don't get this screen.
  private get securityQuestion1Dropdown(): Locator {
    return this.page.getByText('Choose a security question', { exact: false }).first();
  }

  // Tosca: Enter the Answer > Your answer*
  private get securityAnswer1Input(): Locator {
    return this.todo('GepLoginPage.securityAnswer1Input', 'Enter the Answer > Your answer*');
  }

  // Tosca: Click on the security question > Choose second a security question*
  private get securityQuestion2Dropdown(): Locator {
    return this.todo(
      'GepLoginPage.securityQuestion2Dropdown',
      'Click on the security question > Choose second a security question*'
    );
  }

  // Tosca: Enter the Answer > Your answer*_1
  private get securityAnswer2Input(): Locator {
    return this.todo('GepLoginPage.securityAnswer2Input', 'Enter the Answer > Your answer*_1');
  }

  // Tosca: Click on proceed CTA > Proceed
  private get securityProceedButton(): Locator {
    return this.todo('GepLoginPage.securityProceedButton', 'Click on proceed CTA > Proceed');
  }

  /** Tosca: Enter Username And Password and click login. */
  async login(username: string, password: string): Promise<void> {
    await this.expectVisible(this.loginUsernameInput);
    await this.fill(this.loginUsernameInput, username);
    await this.fill(this.loginPasswordInput, password);
    await this.click(this.loginSignInButton);
  }

  /** Tosca: If "Choose a security question*" exists, answer both questions and click Proceed. */
  async answerSecurityQuestionsIfShown(answer: string): Promise<boolean> {
    if (!(await this.isVisibleWithin(this.securityQuestion1Dropdown))) return false;

    // Tosca picks the first question in each dropdown by opening it and pressing Enter.
    await this.click(this.securityQuestion1Dropdown);
    await this.pressKey('Enter');
    await this.fill(this.securityAnswer1Input, answer);

    await this.click(this.securityQuestion2Dropdown);
    await this.pressKey('Enter');
    // Tosca only clicks "Your answer*_1" without typing; the same answer is entered so Proceed can succeed.
    await this.fill(this.securityAnswer2Input, answer);

    await this.click(this.securityProceedButton);
    return true;
  }
}
