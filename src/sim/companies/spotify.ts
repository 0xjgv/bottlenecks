import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, ROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * Spotify: autonomous squads still ship through one shared release.
 *
 * Shape, from the sources: the app goes out in a weekly release; a release
 * may ship only when every team has signed off and no blocking bugs remain;
 * the release manager tracks which teams have not finished their regression
 * testing; blocking bugs can extend a release by days, and advancing a
 * release by hand between its steps delayed it by hours until automation
 * cut that [engineering blog, 2025 and 2026]. That finished changes wait
 * at the release is the model's reading, not the blog's claim. The order,
 * sign-off then the release manager, is assembled from those steps.
 * Blocking bugs are not drawn as a step. The org chart of squads, tribes
 * and chapters is not drawn either: it is an older, different lesson.
 *
 * Why every step is a `service`. A weekly release suggests a recurring
 * ritual (`cron`), but a cron drops its own batch on a schedule and
 * refuses work wired into it, so the squads' changes could never reach it.
 * A backlog with a crew pulling from it lets the squad move on once it
 * hands a change over, so cycle time stops at the hand-over, as it does
 * for QA in the Series A example (not measured here). A service chain holds each change until it ships, so waiting at the
 * release shows in cycle time, which is the lesson. The weekly cadence
 * itself is not modelled: the release is drawn as a steady step.
 *
 *   workA      30/wk changes from one squad
 *   workB      20/wk changes from another
 *   squadA     4 people x 12 at once, half a day each -> 480/wk own work
 *   squadB     4 people x 12 at once, half a day each -> 480/wk own work
 *   signoff    6 teams x 12 at once, 1h each          -> 2880/wk
 *              (most slots are changes blocked on the release manager)
 *   release    1 release manager, 10 at once, half a day each
 *                                                     -> 100/wk <- constraint
 *              load: 50/wk at 1x, 100 at 2x, 150 at 3x
 *   Measured (seed 1): at 2x the release manager is full but 0.9% is
 *   dropped and the slowest 1 in 100 takes 3.5 days against 2.1 at 1x, so
 *   the forecast breaks at 3x: 99.5/wk ship, 36.0% is dropped at the
 *   release manager's full backlog, the slowest take 4.2 days, while the
 *   squads are under 20% busy and sign-off under 5%. Doubling both squads
 *   at 3x: 32.9% dropped. Halving the release manager's hands-on time to
 *   2h instead: nothing dropped, 155/wk ship, slowest 1.7 days.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('workA', 'client', 'Squad A changes', COL(0), ROW(0), {
      rps: 30,
      timeoutMs: 3000,
    }),
    node('workB', 'client', 'Squad B changes', COL(0), ROW(2), {
      rps: 20,
      timeoutMs: 3000,
    }),
    node('squadA', 'service', 'Squad A', COL(1), ROW(0), {
      instances: 4,
      capacity: 12,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('squadB', 'service', 'Squad B', COL(1), ROW(2), {
      instances: 4,
      capacity: 12,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('signoff', 'service', 'Team sign-off', COL(2), ROW(1), {
      instances: 6,
      capacity: 12,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('release', 'service', 'Release manager', COL(3), ROW(1), {
      capacity: 10,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
  ],
  edges: [
    edge('workA', 'squadA'),
    edge('workB', 'squadB'),
    edge('squadA', 'signoff'),
    edge('squadB', 'signoff'),
    edge('signoff', 'release'),
  ],
  annotations: [
    sectionOver('spt-sec-build', 'Building changes', 0, 0, 1, 0, 2),
    sectionOver('spt-sec-release', 'Releasing the app', 1, 2, 3, 1, 1),
    note(
      'spt-note-source',
      1088,
      16,
      "From Spotify's engineering blog: the weekly app release ships only once every team has signed off and no blocking bugs remain, and moving it between steps by hand cost hours. Every number here is the model's, not Spotify's.",
      400,
    ),
    note(
      'spt-note-lesson',
      1088,
      200,
      "A squad is Spotify's word for a small product team. Each finishes changes on its own, but in this model every change then waits for the teams' sign-off and the release manager. Drag incoming work to 3x: the release manager is full, about 100 changes a week ship however many the squads finish, 36 percent is dropped and the slowest take 4.2 days instead of 2.1.",
      320,
    ),
    note(
      'spt-note-fix',
      1440,
      200,
      'More squads do not help: double the people in both at 3x and 33 percent is still dropped. A faster release does; the blog says automating the hand-offs cut delays. In this model, select the release manager and halve the hands-on time per change: at 3x nothing is dropped and the slowest change ships in 1.7 days, not 4.2.',
      300,
    ),
  ],
};

export const spotify: CompanyPreset = {
  id: 'spotify',
  name: 'Spotify',
  tagline: 'Autonomous teams still share one release',
  description:
    'A simplified model from public sources: two product teams finish changes on their own, then every change waits for the sign-off of all teams and the release manager before the weekly app release ships. Turn up incoming work and watch finished changes queue at the release manager while the product teams still have room.',
  sources: [
    {
      title: 'Spotify engineering, 2025',
      url: 'https://engineering.atspotify.com/2025/4/how-we-release-the-spotify-app-part-1',
    },
    {
      title: 'Spotify engineering, 2026',
      url: 'https://engineering.atspotify.com/2026/2/how-we-release-the-spotify-app-part-2',
    },
  ],
  constraint: 'release',
  topology,
};
