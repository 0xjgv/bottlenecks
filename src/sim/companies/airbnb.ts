import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, ROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * Airbnb before 2020: too many projects back up the shared teams.
 *
 * Shape, from the sources: before 2020 the company had separate guest and
 * host teams, which it no longer has [interview]; the teams everyone
 * depends on "get this backup like a deli" until people give up, and the
 * company was doing too many projects at once [interview, Fortune]. Its
 * answer after 2020 was one roadmap and far fewer projects. That later
 * shape, and the chief executive's reviews in it, are not drawn: this is
 * the map the change was made to remove.
 *
 * No source names the shared teams or says how work splits between guest
 * and host projects; the 30/20 split is the model's. Each product team
 * calls the shared teams directly and holds its project while it waits,
 * which is what "depends on" means in the engine.
 *
 * People giving up is each source's deadline: a project not finished in a
 * week and a half is given up on. The engine does not cancel abandoned
 * work, so the shared teams go on working on projects nobody is waiting
 * for, which is why work finished stalls below their ceiling.
 *
 * The shared teams' backlog holds 100 projects. Longer, and the wait
 * passes the give-up time for nearly everyone: measured with 130, under
 * 1/wk finishes at 3x. Shorter, and few give up, they are turned away
 * instead: with 90, 3.6% gives up at 2x.
 *
 *   guest       30/wk guest projects
 *   host        20/wk host projects
 *   guestTeam   4 people x 30 at once, half a day each -> 1200/wk own work
 *   hostTeam    4 people x 30 at once, half a day each -> 1200/wk own work
 *               (most of those slots are projects blocked on the shared
 *               teams; enough that the product teams never fill, so
 *               doubling them changes nothing)
 *   shared      6 people x 3 at once, 1 day each       ->  90/wk <- constraint
 *               load: 50/wk at 1x, 75 at 1.5x, 100 at 2x
 *   Measured (seed 1): shared teams 47% busy at 1x and 70% at 1.5x with
 *   nothing lost; at 2x they are full with 96 projects waiting, 23.9% of
 *   projects are lost (11.9% given up on after they started, 12.0% turned
 *   away at the full backlog) and work finished stalls at 75/wk, against
 *   74/wk at 1.5x. At 4x: 79/wk finished, 61.5% lost. Doubling both
 *   product teams at 2x: the same 75/wk and 23.9%. An intake limit in
 *   front of each team instead, 45 and 30 projects a week (default burst):
 *   81/wk finished, nothing given up on, 22.3% turned away before it
 *   starts, slowest 1 in 100 at 1.1 weeks instead of 1.5.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('guest', 'client', 'Guest projects', COL(0), ROW(0), {
      rps: 30,
      timeoutMs: 1500,
    }),
    node('host', 'client', 'Host projects', COL(0), ROW(2), {
      rps: 20,
      timeoutMs: 1500,
    }),
    node('guestTeam', 'service', 'Guest team', COL(1), ROW(0), {
      instances: 4,
      capacity: 30,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('hostTeam', 'service', 'Host team', COL(1), ROW(2), {
      instances: 4,
      capacity: 30,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('shared', 'service', 'Shared teams', COL(2), ROW(1), {
      instances: 6,
      capacity: 3,
      serviceMs: 200,
      serviceCv: 0.5,
      queueLimit: 100,
    }),
  ],
  edges: [
    edge('guest', 'guestTeam'),
    edge('host', 'hostTeam'),
    edge('guestTeam', 'shared'),
    edge('hostTeam', 'shared'),
  ],
  annotations: [
    sectionOver('abb-sec-start', 'Starting projects', 0, 0, 1, 0, 2),
    sectionOver('abb-sec-shared', 'Work every project needs', 1, 2, 2, 1, 1),
    note(
      'abb-note-source',
      816,
      16,
      "Before 2020, as its chief executive describes it: separate guest and host teams, and shared teams everyone depends on, where work backed up until people gave up. Every number here is the model's, not Airbnb's.",
      360,
    ),
    note(
      'abb-note-lesson',
      816,
      200,
      'Guest and host projects start in their own team, then wait on the same shared teams. Drag incoming work to 2x: the shared teams fill, 24 percent of projects are lost, half of them given up on after they started, and work finished stalls at 75 a week, as at 1.5x, because the shared teams still work on projects nobody is waiting for.',
      320,
    ),
    note(
      'abb-note-fix',
      1176,
      200,
      'More people do not help: double the guest and host teams at 2x and the same 75 a week finish. Starting fewer projects does; its answer was one roadmap and far fewer projects. Put an intake limit in front of each team, 45 and 30 a week: 81 finish, nothing is given up on after it starts, and 22 percent is turned away before anyone starts it.',
      300,
    ),
  ],
};

export const airbnb: CompanyPreset = {
  id: 'airbnb',
  name: 'Airbnb',
  tagline: 'Too many projects back up the shared teams',
  description:
    'A simplified model from public sources of Airbnb before 2020: guest and host projects start in their own teams, then all wait on the same shared teams. Turn up incoming work and watch the shared teams fill until people give up on projects already started.',
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
  topology,
};
