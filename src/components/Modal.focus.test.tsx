// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Designs } from './Designs';
import { Examples } from './Examples';
import { Settings } from './Settings';
import { Share } from './Share';
import { Challenges } from './Challenges';
import { LearningPath } from '../learn/LearningPath';
import { PRESETS } from '../sim/presets';
import { CHALLENGES } from '../sim/challenges';

const DIALOGS: readonly {
  name: string;
  render: (open: boolean, close: () => void) => ReactNode;
}[] = [
  { name: 'Settings', render: (open, onClose) => <Settings {...{ open, onClose }} /> },
  {
    name: 'Designs',
    render: (open, onClose) => (
      <Designs
        {...{ open, onClose }}
        onOpen={() => {}}
        onSave={() => {}}
        suggestedName="Our workflow"
      />
    ),
  },
  {
    name: 'Examples',
    render: (open, onClose) => (
      <Examples
        {...{ open, onClose }}
        presets={PRESETS.slice(0, 2)}
        activePresetId={null}
        onLoad={() => {}}
      />
    ),
  },
  {
    name: 'Challenges',
    render: (open, onClose) => (
      <Challenges
        {...{ open, onClose }}
        challenges={CHALLENGES.slice(0, 2)}
        onStart={() => {}}
        badgeOf={() => null}
      />
    ),
  },
  {
    name: 'Learning path',
    render: (open, onClose) => (
      <LearningPath
        {...{ open, onClose }}
        presets={PRESETS}
        challenges={CHALLENGES}
        explored={new Set()}
        badgeOf={() => null}
        activePresetId={null}
        activeChallengeId={null}
        onLoadExample={() => {}}
        onStartChallenge={() => {}}
      />
    ),
  },
  {
    name: 'Share',
    render: (open, onClose) => (
      <Share
        {...{ open, onClose }}
        onBuild={async () => ({ ok: true, url: 'https://bottlenecks.test/#design' })}
        onExport={() => {}}
      />
    ),
  },
];

let container: HTMLDivElement;
let root: Root;
let opener: HTMLButtonElement;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  container = document.createElement('div');
  opener = document.createElement('button');
  opener.textContent = 'Open';
  document.body.append(opener, container);
  opener.focus();
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function dialog(): HTMLElement {
  const card = document.querySelector<HTMLElement>(
    '[role="dialog"][aria-modal="true"]',
  );
  if (!card) throw new Error('No open dialog');
  return card;
}

function tab(target: HTMLElement, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  act(() => target.dispatchEvent(event));
  return event;
}

describe.each(DIALOGS)('$name focus', ({ render }) => {
  it('moves focus into the dialog and returns it to the opener on close', () => {
    const close = vi.fn();
    act(() => root.render(render(true, close)));
    expect(dialog().contains(document.activeElement)).toBe(true);
    act(() => root.render(render(false, close)));
    expect(document.activeElement).toBe(opener);
  });

  it('wraps Tab at both ends instead of sending focus behind the dialog', () => {
    act(() => root.render(render(true, () => {})));
    const card = dialog();
    const controls = [
      ...card.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select, textarea, a[href], [tabindex="0"]',
      ),
    ].filter(
      (el) =>
        !el.closest('[hidden], [inert]') &&
        !(el instanceof HTMLInputElement && el.type === 'radio' && !el.checked),
    );
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) throw new Error('Dialog has no controls');
    act(() => last.focus());
    expect(tab(last).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(tab(first, true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });
});

it('opens the examples without focusing a text input on touch', () => {
  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    matches: media === '(pointer: coarse)',
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  }));
  act(() =>
    root.render(
      <Examples
        open
        onClose={() => {}}
        presets={PRESETS}
        activePresetId={null}
        onLoad={() => {}}
      />,
    ),
  );
  expect(document.activeElement).toBe(dialog());
});
