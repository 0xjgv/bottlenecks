import type { Preset } from './presets';
import { openai } from './companies/openai';
import { anthropic } from './companies/anthropic';
import { spacex } from './companies/spacex';
import { nvidia } from './companies/nvidia';
import { tesla } from './companies/tesla';
import { stripe } from './companies/stripe';
import { gitlab } from './companies/gitlab';
import { spotify } from './companies/spotify';
import { airbnb } from './companies/airbnb';
import { amazon } from './companies/amazon';
import { apple } from './companies/apple';

/*
 * Real companies, drawn from what they say about themselves.
 *
 * The hard rule is about facts, as it is for the incidents. Each map runs
 * the whole company, from where work comes in to where it reaches customers,
 * and says which parts of that are the company's:
 *
 * - SOURCED steps: every step, sign-off and the constraint that a public
 *   source describes, under the source's own name. `sources` links them.
 * - TYPICAL steps: what a company like this needs to connect the ends
 *   (selling, onboarding, support) where no source says how this one does
 *   it. They are listed in `typical`, and on the canvas they sit together
 *   inside a section whose label ends "(typical, not sourced)", because a
 *   note is often out of view. A typical step is never the constraint, and
 *   typical steps never outnumber sourced ones: a thinly sourced company
 *   gets a narrower map, not a padded one.
 * - Every NUMBER is the model's: headcounts, volumes and times are chosen so
 *   the example holds at today's load and breaks at the named constraint,
 *   and one note on each canvas says so. Never quote a figure as the
 *   company's own, and never name a person: roles outlast the people in
 *   them.
 *
 * One file per company in ./companies. Units and measuring rules are those
 * of presets.startups.ts. presets.companies.test.ts holds every map to the
 * rule above.
 */

export interface CompanyPreset extends Preset {
  sources: readonly { title: string; url: string }[];
  /** The step a source names as the constraint. The forecast must agree. */
  constraint: string;
  /** Steps no source describes, added to connect the ends. Often empty. */
  typical: readonly string[];
}

export const COMPANY_PRESETS: CompanyPreset[] = [
  openai,
  anthropic,
  spacex,
  nvidia,
  tesla,
  stripe,
  gitlab,
  spotify,
  airbnb,
  amazon,
  apple,
];
