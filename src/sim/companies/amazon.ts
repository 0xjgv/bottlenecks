import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, ROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * Amazon: layers of management put meetings in front of every decision.
 *
 * Shape, from the sources: its chief executive wrote in 2024 that the
 * company had added more layers, with "pre-meetings for the pre-meetings for
 * the decision meetings", and set a target to raise the ratio of individual
 * contributors to managers by at least 15 percent [memo]. A proposal is
 * written by whoever had the idea as a press release and questions (the
 * PR/FAQ), reviewed with stakeholders, then presented to the executive
 * leaders, who approve it [working backwards]. A two-pizza team with one
 * owner builds it [AWS]. The memo and the proposal process are separate
 * documents and no source gives the chain end to end; the order below is
 * assembled from them. Only two pre-meeting layers are drawn, the two the
 * memo's phrase names. The sources say only a few proposals get the green
 * light; a refusal would count as lost work in the forecast, so every
 * proposal passes here.
 *
 * Which meeting fills first is the model's choice; no source ranks them.
 * The pre-pre-meeting is the tightest, so it is the constraint, and the
 * memo names the pre-meetings, not the decision meeting, as the problem.
 *
 * The meetings are decision makers (`db`, all decisions, no lock wait). A
 * seat is held for the meeting only, a full meeting keeps the proposal
 * waiting in its backlog, and the proposal then moves on. Standing meetings
 * (`websocket`) refuse outright when every seat is held and let the item
 * move on before the meeting ends: measured with the same seats, 12.0% is
 * dropped already at 1x and the median cycle time leaves the meetings out
 * (4.1h against 7h). A team (`service`) holds its seat until everything
 * after it is done, so the pre-pre-meeting would stay booked through the
 * other meetings and the build: measured, 76.3% dropped at 0.5x and nothing
 * finished at 1x.
 *
 *   proposals   30/wk
 *   prepre      2 at once, 1h each                          ->  80/wk <- constraint
 *   pre         3 at once, 1h each                          -> 120/wk
 *   decision    3 at once, 1h each                          -> 120/wk
 *   build       6 teams x 3 at once, half a day each        -> 180/wk
 *   Measured (seed 1): nothing dropped up to 2x, slowest 1.7d at 1x. At 3x
 *   the pre-pre-meeting is full, finishes 80/wk, 12.3% is dropped and the
 *   slowest take 4d; the pre-meeting and decision meeting are 75% busy and
 *   the teams 43%. Deleting the pre-pre-meeting at 3x: nothing dropped,
 *   slowest 1.7d. Doubling the teams to 12 at 3x: 12.3% dropped.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('proposals', 'client', 'Team proposals', COL(0), ROW(0), {
      rps: 30,
      timeoutMs: 3000,
    }),
    node('prepre', 'db', 'Pre-pre-meeting', COL(1), ROW(0), {
      capacity: 2,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
      readFraction: 0,
      lockMs: 0,
    }),
    node('pre', 'db', 'Pre-meeting', COL(2), ROW(0), {
      capacity: 3,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
      readFraction: 0,
      lockMs: 0,
    }),
    node('decision', 'db', 'Decision meeting', COL(3), ROW(0), {
      capacity: 3,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
      readFraction: 0,
      lockMs: 0,
    }),
    node('build', 'service', 'Build teams', COL(4), ROW(0), {
      instances: 6,
      capacity: 3,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
  ],
  edges: [
    edge('proposals', 'prepre'),
    edge('prepre', 'pre'),
    edge('pre', 'decision'),
    edge('decision', 'build'),
  ],
  annotations: [
    sectionOver('amz-sec-decide', 'Getting to a yes', 0, 1, 3, 0, 0),
    note(
      'amz-note-source',
      40,
      216,
      "In 2024 Amazon's chief executive wrote that it had added layers, with pre-meetings for the pre-meetings for the decision meetings, and set a target of at least 15 percent more individual contributors per manager. Every number here is the model's, not Amazon's.",
      320,
    ),
    note(
      'amz-note-lesson',
      392,
      216,
      'Each proposal clears a pre-meeting for the pre-meeting, a pre-meeting and the decision meeting, then a two-pizza team, small enough to feed with two pizzas, builds it. Drag incoming work to 3x: the pre-pre-meeting fills, 12 percent of proposals are dropped and the slowest take 4 days instead of 1.7. The other meetings are 75 percent busy and the builders 43 percent.',
      360,
    ),
    note(
      'amz-note-fix',
      784,
      216,
      'More builders do not help: double the two-pizza teams at 3x and 12 percent is still dropped. Fewer layers do: delete the pre-pre-meeting, connect team proposals to the pre-meeting, and dropped work at 3x falls from 12 percent to nothing.',
      320,
    ),
  ],
};

export const amazon: CompanyPreset = {
  id: 'amazon',
  name: 'Amazon',
  tagline: 'Layers put meetings before every decision',
  description:
    "A simplified model from public sources: a team's written proposal clears a pre-meeting for the pre-meeting and a pre-meeting before leadership's decision meeting, then a small team builds it. Turn up incoming work and watch the first meeting fill while the builders still have room.",
  sources: [
    {
      title: "Chief executive's memo, 2024",
      url: 'https://www.aboutamazon.com/news/company-news/ceo-andy-jassy-latest-update-on-amazon-return-to-office-manager-team-ratio',
    },
    {
      title: 'Amazon on working backwards, 2021',
      url: 'https://www.aboutamazon.com/news/workplace/an-insider-look-at-amazons-culture-and-processes',
    },
    {
      title: 'AWS on two-pizza teams',
      url: 'https://aws.amazon.com/executive-insights/content/amazon-two-pizza-team/',
    },
  ],
  constraint: 'prepre',
  topology,
};
