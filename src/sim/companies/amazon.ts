import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, LROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * Amazon: layers of management put meetings in front of every decision.
 *
 * Sourced steps, by source:
 * - Amazon on working backwards, 2021: the person who had the idea writes
 *   a draft press release and frequently asked questions (the PR/FAQ),
 *   reviews it in a meeting with stakeholders, then presents it to the
 *   executive leaders, who give it the green light.
 * - Chief executive's memo, 2024: the company had added layers, with
 *   "pre-meetings for the pre-meetings for the decision meetings", and set
 *   a target to raise the ratio of individual contributors to managers by
 *   at least 15 percent. Only the two pre-meeting layers the phrase names
 *   are drawn; the executive review is its decision meeting.
 * - AWS on two-pizza teams: a small team with single-threaded ownership
 *   builds the product or service and owns it.
 * - AWS on weekly business reviews: teams and leaders meet weekly to
 *   review the numbers they are measured on.
 *
 * Typical, not sourced: customers, customer support and the launch. No
 * fetched source says how a finished product reaches customers or how
 * their asks reach the team. In this model a support ask goes to the team
 * that owns the product, as the owner of a service would take it.
 *
 * The order is assembled; no single source gives the whole chain. Where
 * the pre-meetings sit (between the stakeholder review and the decision
 * meeting) and that the business review follows each launch are the
 * model's choices. The engine routes by edge, not by where work came from,
 * so support asks also pass the launch and the business review in this
 * model. The only fetched source on where ideas start names the person who
 * had the idea, not a customer, so new ideas are their own source of work.
 * The sources say only a few proposals get the green light; a
 * refusal would count as lost work in the forecast, so every proposal
 * passes here.
 *
 * Which meeting fills first is the model's choice; no source ranks them.
 * The pre-pre-meeting is the tightest, so it is the constraint, and the
 * memo names the pre-meetings, not the decision meeting, as the problem.
 *
 * The meetings are decision makers (`db`, all decisions, no lock wait). A
 * seat is held for the meeting only, a full meeting keeps the proposal
 * waiting in its backlog, and the proposal then moves on. Measured on this
 * map (seed 1): as standing meetings (`websocket`), which refuse outright
 * when every seat is held and let the item move on before the meeting
 * ends, 5.4% is dropped already at 1x and the median cycle time leaves the
 * meetings out (6.2h against 1d). As teams (`service`), which hold a seat
 * until everything after them is done, 43.8% is dropped at 0.5x and 45.5%
 * at 1x.
 *
 *   ideas        30/wk new ideas
 *   customers    40/wk support asks
 *   prfaq        10 people x 10 at once, 2h each            -> 2000/wk own work
 *                (holds its slot while the proposal is in meetings and
 *                being built, which is why it gets so many)
 *   stakeholders 6 at once, 1h each                          ->  240/wk
 *   prepre       2 at once, 1h each                          ->   80/wk <- constraint
 *   pre          3 at once, 1h each                          ->  120/wk
 *   decision     3 at once, 1h each                          ->  120/wk
 *   support      60 at once, 1h each                         -> 2400/wk
 *   build        12 teams x 4 at once, half a day each       ->  480/wk own work
 *   launch       60 at once, 1h each                         -> 2400/wk
 *   review       8 at once, 30 min each                      ->  640/wk
 *                load: meetings 30/wk at 1x; build, launch and review
 *                30 ideas + 40 asks = 70/wk at 1x
 *   Measured (seed 1): nothing dropped up to 2x, slowest 1 in 100 at 2.2
 *   days at 1x. At 3x the pre-pre-meeting is full, finishes 82.9/wk, 4.1%
 *   of all work is dropped (every bit of it new ideas) and the slowest take
 *   4.5 days; the pre-meeting is 69% busy, the decision meeting 70% and
 *   the build teams 42%. Seeds 2 and 3 break at 3x too, at 4.0% and 5.6%.
 *   Deleting the pre-pre-meeting at 3x: nothing dropped on seeds 1 to 3,
 *   slowest 2.1 days. Doubling the build teams to 24 at 3x: 4.1% dropped,
 *   unchanged.
 * ------------------------------------------------------------------ */

const meeting = (capacity: number, serviceMs: number) => ({
  capacity,
  serviceMs,
  serviceCv: 0.5,
  queueLimit: 40,
  readFraction: 0,
  lockMs: 0,
});

const topology: Topology = {
  nodes: [
    node('ideas', 'client', 'New ideas', COL(0), LROW(1, 1), {
      rps: 30,
      timeoutMs: 3000,
    }),
    node('prfaq', 'service', 'Write PR/FAQ', COL(0), LROW(2, 2), {
      instances: 10,
      capacity: 10,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('stakeholders', 'db', 'Stakeholders', COL(1), LROW(2, 2), meeting(6, 25)),
    node('prepre', 'db', 'Pre-pre-meeting', COL(1), LROW(1, 1), meeting(2, 25)),
    node('pre', 'db', 'Pre-meeting', COL(2), LROW(1, 1), meeting(3, 25)),
    node('decision', 'db', 'Executive review', COL(3), LROW(1, 1), meeting(3, 25)),
    node('review', 'db', 'Business review', COL(4), LROW(1, 1), meeting(8, 12.5)),
    node('customers', 'client', 'Customers', COL(1), LROW(0, 0), {
      rps: 40,
      timeoutMs: 3000,
    }),
    node('support', 'service', 'Customer support', COL(2), LROW(0, 0), {
      capacity: 60,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 40,
    }),
    node('build', 'service', 'Build teams', COL(3), LROW(0, 0), {
      instances: 12,
      capacity: 4,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('launch', 'service', 'Launch', COL(4), LROW(0, 0), {
      capacity: 60,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
  ],
  edges: [
    edge('ideas', 'prfaq'),
    edge('prfaq', 'stakeholders'),
    edge('stakeholders', 'prepre'),
    edge('prepre', 'pre'),
    edge('pre', 'decision'),
    edge('decision', 'build'),
    edge('customers', 'support'),
    edge('support', 'build'),
    edge('build', 'launch'),
    edge('launch', 'review'),
  ],
  /* What the measures count: model documentation, the engine never reads it.
     New ideas are Amazon's own work, not output; customers are. */
  measures: {
    notOutput: ['ideas'],
  },
  annotations: [
    sectionOver('amz-sec-write', 'Writing it up', 1, 0, 1, 2, 2, 2),
    sectionOver(
      'amz-sec-meet',
      'Meetings: getting to a yes, and the weekly business review',
      0,
      1,
      4,
      1,
      1,
      1,
    ),
    sectionOver(
      'amz-sec-customers',
      'Customers and support (typical, not sourced)',
      2,
      1,
      2,
      0,
      0,
      0,
    ),
    sectionOver('amz-sec-build', 'Building and owning it', 1, 3, 3, 0, 0, 0),
    sectionOver('amz-sec-launch', 'Launch (typical, not sourced)', 2, 4, 4, 0, 0, 0),
    note(
      'amz-note-lesson',
      40,
      568,
      'Layers put meetings in front of every decision: an idea passes a pre-meeting for the pre-meeting and a pre-meeting before the executive review decides. Drag incoming work to 3x: the pre-pre-meeting fills, 4 percent of work is dropped, all of it new ideas, and the slowest take 4.5 days instead of 2.2. The build teams, two-pizza teams small enough to feed with two pizzas, are 42 percent busy.',
      360,
    ),
    note(
      'amz-note-fix',
      432,
      568,
      'More builders do not help: double the build teams at 3x and 4 percent is still dropped. Fewer layers do: delete the pre-pre-meeting, connect stakeholders to the pre-meeting, and dropped work at 3x falls from 4 percent to nothing.',
      320,
    ),
    note(
      'amz-note-source',
      784,
      568,
      "The chief executive's 2024 memo names the pre-meetings and a target of at least 15 percent more individual contributors per manager. The PR/FAQ (press release and questions) and the stakeholder and executive reviews follow working backwards; the two-pizza build teams and weekly review follow AWS. Support and launch are typical, not from a source. Every number here is the model's, not Amazon's.",
      360,
    ),
  ],
};

export const amazon: CompanyPreset = {
  id: 'amazon',
  name: 'Amazon',
  tagline: 'Layers put meetings before every decision',
  description:
    'A simplified model of the whole company from public sources, with customer support and the launch as typical steps where the sources are silent. Turn up incoming work and watch the pre-meeting for the pre-meeting fill while the build teams still have room.',
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
    {
      title: 'AWS on weekly business reviews',
      url: 'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ls.3-drive-continued-improvement-through-business-reviews.html',
    },
  ],
  constraint: 'prepre',
  typical: ['support', 'launch'],
  topology,
};
