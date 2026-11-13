import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, ROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * Airbnb before 2020: too many projects back up the shared teams.
 *
 * Sourced steps, all from its chief executive's 2023 interview, with
 * Fortune, 2023 for the projects: before 2020 the company had a guest team
 * and a host team, which it no longer has, and separate teams tend to have
 * roadmaps of their own that drift apart; the teams everyone depends on
 * "get this backup like a deli" until people give up; and it was doing too
 * many projects at once. Its answer after 2020 was one roadmap
 * and far fewer projects. That later shape, and the chief executive's
 * reviews in it, are not drawn: this is the map the change was made to
 * remove.
 *
 * Typical, not sourced: guests and hosts as where work comes from, and
 * support passing what they need on to their team. The sources describe
 * the company in so few steps that the map stays at 7 boxes rather than
 * padding it out; no source says how finished work reaches guests and
 * hosts, so it ends at the shared teams.
 *
 * No source names the shared teams or says how work splits between guest
 * and host projects; the 30/20 split is the model's. Each product team
 * calls the shared teams directly and holds its project while it waits,
 * which is what "depends on" means in the engine.
 *
 * People giving up is each source's deadline: a project not finished in a
 * week and a half is given up on. The engine does not cancel abandoned
 * work, so the shared teams go on working on projects nobody is waiting
 * for, which is why work finished stalls below their ceiling. Their work is
 * fairly even (a spread of 0.3, against 0.5 or more elsewhere), which keeps
 * the slowest at 1x to 2.4 days; with 0.5 it is 2.9 days. Their backlog
 * holds 110 projects. Longer, and the wait passes the give-up time for
 * nearly everyone: measured with 115, up to 91.5% is lost and as little as
 * 16.9/wk finishes. Shorter, and few give up, they are turned away instead:
 * with 105, 5.0% gives up at 2x.
 *
 *   guest        30/wk guest projects
 *   host         20/wk host projects
 *   guestSupport 120 at once, 30 min each               -> 9600/wk (typical)
 *   hostSupport  120 at once, 30 min each               -> 9600/wk (typical)
 *   guestTeam    4 people x 30 at once, 3h each         -> 1600/wk own work
 *   hostTeam     4 people x 30 at once, 3h each         -> 1600/wk own work
 *                (most of those slots, and support's, are projects blocked
 *                on the shared teams; enough that they never fill, so
 *                doubling the product teams changes nothing)
 *   shared       6 people x 3 at once, 1 day each       ->  90/wk <- constraint
 *                load: 50/wk at 1x, 75 at 1.5x, 100 at 2x
 *   Measured (seed 1): shared teams 68% busy at 1x and 83% at 1.5x with
 *   nothing lost, slowest 1 in 100 at 2.4 days (2.4 on seeds 2 and 3 too);
 *   at 2x they are full with 107 projects waiting, 20.6% of projects are
 *   lost (13.2% given up on after they started, 7.4% turned away at the
 *   full backlog) and work finished stalls at 77/wk, against 75/wk at 1.5x,
 *   while the product teams are under 5% busy. Seeds 2 and 3 break at 2x
 *   too, at 28.1% and 34.4%. At 4x: 42/wk finished, 79.2% lost (80.4% on
 *   seed 2, the most on any seed). Doubling both product teams at 2x: the
 *   same 77/wk and 20.6%. An intake limit in front of each team instead,
 *   50 and 35 projects a week (default burst): 91/wk finished, nothing given
 *   up on, 11.1% turned away before it starts, slowest 1 in 100 at 1.1 weeks
 *   instead of 1.5. On seeds 2 and 3 the limit gives 84 and 86/wk against
 *   72 and 65, with 5.5% and 4.0% still given up on.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('guest', 'client', 'Guests', COL(0), ROW(0), {
      rps: 30,
      timeoutMs: 1500,
    }),
    node('host', 'client', 'Hosts', COL(0), ROW(2), {
      rps: 20,
      timeoutMs: 1500,
    }),
    node('guestSupport', 'service', 'Guest support', COL(1), ROW(0), {
      capacity: 120,
      serviceMs: 12.5,
      serviceCv: 0.6,
      queueLimit: 40,
    }),
    node('hostSupport', 'service', 'Host support', COL(1), ROW(2), {
      capacity: 120,
      serviceMs: 12.5,
      serviceCv: 0.6,
      queueLimit: 40,
    }),
    node('guestTeam', 'service', 'Guest team', COL(2), ROW(0), {
      instances: 4,
      capacity: 30,
      serviceMs: 75,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('hostTeam', 'service', 'Host team', COL(2), ROW(2), {
      instances: 4,
      capacity: 30,
      serviceMs: 75,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('shared', 'service', 'Shared teams', COL(3), ROW(1), {
      instances: 6,
      capacity: 3,
      serviceMs: 200,
      serviceCv: 0.3,
      queueLimit: 110,
    }),
  ],
  edges: [
    edge('guest', 'guestSupport'),
    edge('host', 'hostSupport'),
    edge('guestSupport', 'guestTeam'),
    edge('hostSupport', 'hostTeam'),
    edge('guestTeam', 'shared'),
    edge('hostTeam', 'shared'),
  ],
  /* No measures field: guests and hosts are both customers, and every step
     is Airbnb's own people. */
  annotations: [
    sectionOver(
      'abb-sec-support',
      'Guests, hosts and support (typical, not sourced)',
      2,
      0,
      1,
      0,
      2,
    ),
    sectionOver('abb-sec-start', 'Starting projects', 0, 2, 2, 0, 2),
    sectionOver('abb-sec-shared', 'Work every project needs', 1, 3, 3, 1, 1),
    note(
      'abb-note-lesson',
      40,
      440,
      'Guest and host projects start in their own team, then wait on the same shared teams. Drag incoming work to 2x: the shared teams fill, 21 percent of projects are lost, most of them given up on after they started, and work finished stalls at 77 a week, about what 1.5x gave, because the shared teams still work on projects nobody is waiting for.',
      360,
    ),
    note(
      'abb-note-fix',
      432,
      440,
      'More people do not help: double the guest and host teams at 2x and the same 77 a week finish. Starting fewer projects does; its answer was one roadmap and far fewer projects. Put an intake limit in front of each team, 50 and 35 a week: 91 finish, little or nothing is given up on after it starts, and 11 percent is turned away before a team starts it.',
      320,
    ),
    note(
      'abb-note-source',
      784,
      440,
      "Before 2020, as its chief executive describes it: separate guest and host teams, and shared teams everyone depends on, where work backed up until people gave up. Support is typical, not from a source. Every number here is the model's, not Airbnb's.",
      360,
    ),
  ],
};

export const airbnb: CompanyPreset = {
  id: 'airbnb',
  name: 'Airbnb',
  tagline: 'Too many projects back up the shared teams',
  description:
    'A simplified model of the whole company before 2020 from public sources, with support as a typical step where the sources are silent. Turn up incoming work and watch the shared teams fill until people give up on projects already started.',
  sources: [
    {
      title: "Lenny's Podcast interview, 2023",
      url: 'https://www.lennysnewsletter.com/p/brian-cheskys-contrarian-approach',
    },
    {
      title: 'Fortune, 2023',
      url: 'https://fortune.com/2023/09/15/airbnb-ceo-brian-chesky-leadership-strategy-success/',
    },
  ],
  constraint: 'shared',
  typical: ['guestSupport', 'hostSupport'],
  topology,
};
