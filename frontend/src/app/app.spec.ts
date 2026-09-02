import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the app title as a link home', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const title = (fixture.nativeElement as HTMLElement).querySelector('.app-title');
    expect(title?.textContent).toContain('Career OS');
    expect(title?.getAttribute('href')).toBe('/');
  });
});
