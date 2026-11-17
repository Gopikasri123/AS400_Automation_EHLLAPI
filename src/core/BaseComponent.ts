import { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/** A reusable part of a page (a tab, a section, a widget). Its locators are scoped to `root`. */
export abstract class BaseComponent extends BasePage {
  /** The element that contains the component. */
  protected abstract get root(): Locator;
}
