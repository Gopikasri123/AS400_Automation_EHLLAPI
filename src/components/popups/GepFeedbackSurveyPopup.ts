import { Locator } from '@playwright/test';
import { BasePage } from '../../core/BasePage';

/** Customer feedback survey shown on the order confirmation page (Gen X). */
export class GepFeedbackSurveyPopup extends BasePage {
  // Tosca: Close Customer FeedBack survey popup > Close Survey
  private get feedbackSurveyCloseButton(): Locator {
    return this.page.getByRole('button', { name: /close survey/i });
  }

  // Tosca: Close Customer FeedBack survey popup > Close Survey_1
  private get feedbackSurveyCloseAltButton(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: /survey|feedback/i }).getByRole('button', { name: /close/i });
  }

  /** Tosca: Close Customer FeedBack survey popup (GenX order confirmation). */
  async closeIfShown(): Promise<boolean> {
    // Wait for either close button at once, so an absent survey costs 3 s instead of 6 s.
    return this.clickIfVisible(this.feedbackSurveyCloseAltButton.or(this.feedbackSurveyCloseButton), 3000);
  }
}
