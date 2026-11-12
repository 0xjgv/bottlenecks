import type { Challenge } from './challenge';
import { INCIDENT_BRIEFS } from './incidents';

/**
 * The briefs.
 *
 * Each one is an existing preset with a load and a goal attached, chosen so
 * that the design as it ships FAILS and a specific, findable change makes it
 * pass. A brief you pass without touching anything teaches nothing, and one
 * with no reachable answer teaches less than that.
 *
 * Every threshold here was measured against the engine, not estimated: the
 * failing number is what the start design actually does at that load, and
 * the passing one is what it does after the change the lesson explains.
 * judge.test.ts pins each brief with the answers that pass it, the wrong
 * fixes that must not, and the ways round it that must not either, because a
 * brief that has drifted from the simulation is worse than no brief.
 *
 * Grouped by `tier`, easiest first. Tier 1 is one part that is too small,
 * tier 2 is behaviour under trouble, tier 3 is losing a part and tier 4 is
 * a problem that hides from the obvious reading.
 */
export const CHALLENGES: Challenge[] = [
  /* ---------------- tier 1 ---------------- */
  {
    id: 'hold-the-line',
    version: 3,
    tier: 1,
    name: 'Hold the line',
    brief:
      'Four engineers ship features, and the founder signs off on every one. 40 feature requests arrive a week, and work feels slow. The team promised that the slowest 1 in 100 features ship within three days. That measure is called p99. They also promised to drop no more than 1 in 100. Right now the slowest take more than a week. Find what is holding them up. You can add room for 4 more tasks at once, as more people or as more tasks each person juggles.',
    presetId: 'single-server',
    loadRps: 40,
    budget: 4,
    goals: [
      { metric: 'p99', max: 600 },
      { metric: 'errorRate', max: 1 },
    ],
    hints: [
      'Slow usually means waiting. Run it and find where work stands in line.',
      'The engineers are barely working. Most of the tasks they hold are finished and waiting on someone else.',
      'Look at the founder. How many sign-offs can they work on at once? How long does each one take?',
    ],
    lesson:
      'The founder was not slow: each sign-off took about two hours, however busy the week got. They could work on only 2 at once, about 40 a week, and 40 a week were arriving, so finished work waited in line. Hiring engineers only adds finished work to the same line. When work is slow, find the line first, because the step with the line is the step to fix.',
  },
  {
    id: 'keep-it-warm',
    version: 3,
    tier: 1,
    name: 'Keep it warm',
    brief:
      'Help docs answer 80 in 100 customer questions, so those never reach a person. That share is called the hit rate. The support lead takes the rest. Questions have grown to 600 a week. Now answers are slow, and about 10 in 100 questions get dropped. You can add room for only 1 more question at once, so the support lead can only grow a little. Answer the slowest 1 in 100 questions within a day, and drop no more than 1 in 100.',
    presetId: 'cache-aside',
    loadRps: 600,
    budget: 1,
    goals: [
      { metric: 'p99', max: 200 },
      { metric: 'errorRate', max: 1 },
    ],
    hints: [
      'The docs are not the step that is full. Look at who sits behind them.',
      'Work out how many of the 600 a week the docs do not answer. Compare that with what the support lead can handle.',
      "Look at the docs' hit rate. How high does it need to be before what gets past the docs fits the support lead?",
    ],
    lesson:
      'The support lead only sees the questions the docs miss, so the lead is sized by the misses, not by every question. Going from 80 to 93 answered in 100 cuts the misses from 120 a week to 42, and this lead can handle about 60. The catch is that the lead now depends on the docs: if they go stale, the full load lands on someone sized for the misses.',
  },
  {
    id: 'nothing-looks-busy',
    version: 2,
    tier: 1,
    name: 'Nothing looks busy',
    brief:
      'At 44 feature requests a week, work piles up at the engineers and about 1 in 10 gets turned away. Yet the engineers read about half busy, and the founder who signs off on their work is about half busy too. Each sign-off takes the founder half a day. Ship the slowest 1 in 100 features within a week, and drop no more than 1 in 100. You can add room for 8 more tasks at once.',
    presetId: 'single-server',
    // Each engineer juggles 2 tasks, not 4, and the founder signs off 8 at
    // once but takes half a day over each: a slow sign-off with room to
    // spare.
    startOverrides: { api: { capacity: 2 }, db: { capacity: 8, serviceMs: 100 } },
    loadRps: 44,
    budget: 8,
    goals: [
      { metric: 'p99', max: 1000 },
      { metric: 'errorRate', max: 1 },
    ],
    hints: [
      'Start where work waits or gets turned away, whatever its busy number says.',
      'Busy only counts the work someone does themselves. A task can be held while nobody works on it.',
      'Look at the engineers. How long do they hold each task? How many tasks does 44 a week need held at once?',
    ],
    lesson:
      'Each engineer held a task until the founder signed it off, about a day in all, though only half a day of that was their own work. The tasks held at once are arrivals times how long each is held: 44 a week for a fifth of a week is about 9, more than the 8 the team could hold. Their busy number only counted their own work, so when a team waits on someone else, give it room for the waiting too.',
  },

  /* ---------------- tier 2 ---------------- */
  {
    id: 'five-seconds',
    version: 2,
    tier: 2,
    name: 'Five bad weeks',
    brief:
      "This support engineer keeps up fine with 25 customer asks a week. In week 10 they hit a bad stretch, and for five weeks every ask takes them twice as long. Some asks will fail while they are slow, and that is fine. But last time, support stayed buried long after the engineer was back to normal. Make sure it recovers. From week 25, drop no more than 2 in 100 asks, and answer the slowest 1 in 100 within two and a half days. You can't add people.",
    presetId: 'retry-storm',
    loadRps: 25,
    warmupS: 25,
    windowS: 45,
    budget: 0,
    faults: [
      {
        atMs: 10_000,
        action: 'inject',
        nodeId: 'db',
        kind: 'slow',
        opts: { factor: 2 },
      },
      { atMs: 15_000, action: 'clear', nodeId: 'db' },
    ],
    goals: [
      { metric: 'errorRate', max: 2 },
      { metric: 'p99', max: 500 },
    ],
    hints: [
      'The support engineer is back to full speed after five weeks. Watch what everyone else does after that.',
      'Once things go wrong, compare how many asks a week customers send with how many reach the support engineer.',
      "Look at what the account managers do when an answer takes too long. What happens to the support engineer's load when every answer comes back late?",
    ],
    lesson:
      'The slow stretch started it, and chasing kept it going: once answers took longer than the account managers would wait, each ask arrived three times. That kept the support engineer buried long after they recovered, a failure that keeps going after its cause is gone. The fix is to stop multiplying the work: chase less, wait longer than a slow answer takes, or turn work away early with a short line.',
  },
  {
    id: 'not-everyones-problem',
    version: 2,
    tier: 2,
    name: "Not everyone's problem",
    brief:
      "Most questions here are answered by the help docs and never reach the support lead. In this run, the support lead has a bad ten weeks, and every question takes them three times as long. Last time, that slowed the whole support inbox and dropped many questions, the ones the docs answer included. Questions that need the lead may fail while they are slow, but the rest must not. Drop no more than 4 in 100 overall, and answer the slowest 1 in 100 within two days. You can't add people.",
    presetId: 'cache-aside',
    // An inbox that can hold 8 questions at once, not 64.
    startOverrides: { api: { capacity: 8 } },
    loadRps: 200,
    budget: 0,
    // With a higher hit rate the questions for the lead get too rare to tie
    // up the inbox.
    locks: [{ kind: 'cache', field: 'hitRate' }],
    faults: [
      {
        atMs: 20_000,
        action: 'inject',
        nodeId: 'db',
        kind: 'slow',
        opts: { factor: 3 },
      },
      { atMs: 30_000, action: 'clear', nodeId: 'db' },
    ],
    goals: [
      { metric: 'errorRate', max: 4 },
      { metric: 'p99', max: 400 },
    ],
    hints: [
      'Most questions never reach the support lead, yet they fail too. Watch what they are waiting for while the lead is slow.',
      'Watch the support inbox during the slow ten weeks. What is each question it holds doing?',
      'Look at the path from the docs to the support lead. How many questions can be waiting on the lead at once? How much of the inbox does that tie up?',
    ],
    lesson:
      "A question the inbox holds while it waits on a slow lead can't make room for anything else, so one slow person spread to every question, even ones the docs answer. Capping how many questions can wait on the lead kept the rest of the inbox free, and the extra ones failed fast instead of piling up. Give each person you depend on a fixed share of your team's attention, so when one goes slow, only the work that needs them suffers.",
  },
  {
    id: 'say-no-fast',
    version: 2,
    tier: 2,
    name: 'Say no fast',
    brief:
      "Feature requests have grown to 45 a week, and almost nothing ships in time. Customers wait three weeks, then give up and go elsewhere. There's no money to hire. Ship as much as you can, quickly. Ship the slowest 1 in 100 features within a week, and turn away no more than 4 in 10.",
    presetId: 'rate-limited-api',
    // An intake limit raised for a launch quarter, and a backlog made deep so
    // that nothing gets dropped.
    startOverrides: {
      limiter: { rateLimitRps: 1000, burst: 1000 },
      api: { queueLimit: 256 },
    },
    loadRps: 45,
    budget: 0,
    goals: [
      // The team finishes about 35 of the 45 a week, so about 22 in 100 is
      // the least that can be turned away. A limit of 28, as the preset
      // ships, turns away 38 in 100.
      { metric: 'errorRate', max: 40 },
      { metric: 'p99', max: 1000 },
    ],
    hints: [
      'Every engineer is busy the whole time, yet almost nothing ships in time. Follow one feature from arriving to shipping.',
      "Watch the engineering team's backlog, the line of work waiting for someone free. How long does the last one in line wait? How long will the customer wait?",
      'Look at the intake limit at the front. How many features a week can the team actually finish? How many does the limit let in?',
    ],
    lesson:
      "Past what it can finish, a team only makes people wait longer, and the deep backlog let that wait grow until everything shipped after the customer had left. Saying no at intake to what it couldn't finish, right away, kept the line short enough for everything else to ship in time. A limit only helps if it sits below what the team can really finish, which is why one raised for a launch quarter did nothing.",
  },
  {
    id: 'buying-time',
    version: 2,
    tier: 2,
    name: 'Buying time',
    brief:
      'Every support ticket gets a quick "got it" straight away, and the real work happens later, when the ticket crew pulls it from the backlog. Tickets now arrive at 160 a week. For the first ten weeks everything looks fine, then tickets start getting refused. Refuse no more than 1 in 100, and let none of the tickets you accepted fail later. Send the slowest 1 in 100 "got it" replies within two hours. You can add room for 6 more tickets at once, as more people or as more tickets each person juggles.',
    presetId: 'async-workers',
    loadRps: 160,
    budget: 6,
    locks: [
      // A deeper backlog only hides the shortfall for longer than the check
      // runs.
      { kind: 'queue', field: 'queueLimit' },
      // A crew that gives up on a ticket after 1ms fails every ticket behind
      // the "got it", where no customer hears of it, and drains the backlog
      // by throwing the work away.
      { kind: 'worker', field: 'timeoutMs' },
    ],
    goals: [
      { metric: 'errorRate', max: 1 },
      { metric: 'p99', max: 50 },
      // A ticket that fails behind the "got it" is lost where no customer
      // sees it. Without this, starving the refund approvals drains the
      // backlog by failing the tickets, and the refusals stop.
      { metric: 'lostJobs', max: 0 },
    ],
    hints: [
      'Nothing fails at the start. Watch which number keeps climbing before the first refusal.',
      'Compare how fast tickets go into the backlog with how fast they come out.',
      'Look at the ticket crew. How many tickets a week can they close? What is each one waiting on?',
    ],
    lesson:
      "A backlog does not fix a shortfall; it only puts it off. Here about 40 tickets a week more came in than the crew could close, so the backlog of 400 filled in about ten weeks and then started refusing tickets. The backlog's size decides how long you can be wrong, but the crew decides whether you are, so watch how deep the backlog is, not only the refusals.",
  },

  /* ---------------- tier 3 ---------------- */
  {
    id: 'lose-a-machine',
    version: 2,
    tier: 3,
    name: 'The founder takes a holiday',
    brief:
      'Every feature waits for the founder to sign off. About 30 arrive a week, and the founder clears up to 40, so there is room to spare and features ship within days. At week 25 the founder goes on holiday for six weeks, and nobody else can sign off. Through all of that, drop no more than 1 in 100 feature requests, and ship the slowest 1 in 100 within four days. You can add room for 6 more tasks at once, as more people or as more tasks each person juggles.',
    presetId: 'single-server',
    loadRps: 30,
    budget: 6,
    allowedNewKinds: ['cache'],
    // A new playbook is allowed, answering the share a playbook answers by
    // default. At 0.99 it hides the absence instead of surviving it.
    locks: [{ kind: 'cache', field: 'hitRate' }],
    faults: [
      { atMs: 25_000, action: 'inject', nodeId: 'db', kind: 'crash-instance' },
      { atMs: 31_000, action: 'clear', nodeId: 'db' },
    ],
    goals: [
      // Six weeks with nobody signing off drop 12 to 15 in 100 of the 45.
      { metric: 'errorRate', max: 1 },
      // Two people who each juggle one sign-off drop little, but the one
      // left builds a line: their slowest take a week and a half or more.
      { metric: 'p99', max: 800 },
    ],
    hints: [
      'Run it and watch week 25. Which step stops everything when it stops?',
      'A founder who juggles more sign-offs is still one person, and still on holiday.',
      'Look at who signs off. If one of the people signing off were away, could the people left clear 30 a week?',
    ],
    lesson:
      'One person is one absence away from zero, however much they juggle. Spread sign-off across several people, and losing one costs a share of the room, as long as the people left can carry the whole load. This is called N+1: plan to lose your busiest person, which is why two people who each juggle one sign-off are not enough.',
  },
  {
    id: 'lose-a-region',
    version: 2,
    tier: 3,
    name: 'The owner leaves',
    brief:
      'Customer escalations go to one owner, about 24 a week, with a backup owner on standby. To save money the backup was kept part-time, taking one escalation at a time. At week 25 the primary owner leaves for good. The handover takes a week, and every escalation in that week fails, so some loss is expected. Across the 60 weeks counted, drop no more than 4 in 100 escalations, and answer the slowest 1 in 100 within a day and a half. You can add room for 4 more tasks at once, as more people or as more tasks each person juggles.',
    presetId: 'multi-region',
    startOverrides: { 'eu-api': { capacity: 1 } },
    loadRps: 24,
    windowS: 60,
    budget: 4,
    locks: [
      // How long the handover takes is the brief's, and so is who starts on duty.
      { kind: 'region', field: 'failoverMs' },
      { kind: 'region', field: 'activeRegion' },
    ],
    // On the owner, not their specialist: the router only watches the node at
    // the end of each of its own connections.
    faults: [{ atMs: 25_000, action: 'inject', nodeId: 'us-api', kind: 'crash' }],
    goals: [
      // The week of handover alone costs between 1 and 3 in 100 of the 60.
      { metric: 'errorRate', max: 4 },
      { metric: 'p99', max: 300 },
    ],
    hints: [
      'Watch what the backup owner does in the weeks after the handover.',
      'Giving the primary owner more room does not help once they have left.',
      'Look at the backup owner. How many escalations can they work on at once? How many does 24 a week need?',
    ],
    lesson:
      'A backup is only as good as the load they can carry on the day you need them. Keep them part-time to save money, and one loss becomes two: the primary leaves, then the backup drowns under work they were never sized for. Size the backup for the full load, and remember the handover itself still costs a week that no amount of room buys back.',
  },
  {
    id: 'checkout-rush',
    version: 2,
    tier: 3,
    name: 'Decisions pile up',
    brief:
      'Last quarter questions waited too long, so the CTO added a fourth deputy to answer them. Now it is crunch time: 180 asks a week, and 4 in 10 of them need a decision, which only the CTO can make. Decisions crawl while the deputies sit half idle. Answer the slowest 1 in 100 asks within a day, and drop no more than 1 in 100. There is no budget: you cannot add room for a single task.',
    presetId: 'read-replicas',
    startOverrides: { replicas: { readFraction: 0.6, replicaCount: 4, capacity: 3 } },
    loadRps: 180,
    budget: 0,
    // A playbook here would make decisions as if they were questions, which
    // no playbook can. With no room to spend there is none for one anyway.
    locks: [{ kind: 'cache', field: 'hitRate' }],
    goals: [
      { metric: 'p99', max: 200 },
      { metric: 'errorRate', max: 1 },
    ],
    hints: [
      'Someone here is swamped and someone is idle. Find both.',
      'Select the CTO and deputies. The first person is the CTO and the rest are deputies. Compare how busy they are.',
      'Look at the CTO and deputies. Where does every decision go? What is a deputy the questions do not need costing you?',
    ],
    lesson:
      'Deputies only ever add room for answers, because every decision still lands on the one CTO. The CTO could make about 60 a week against 72 asked for. The fix was to stop paying for a deputy the questions did not need and put that time into more tasks each person juggles, which raised what the CTO could decide. When decisions outgrow one person, the next step is to split who decides what, by area or by customer, not to add more deputies.',
  },

  /* ---------------- tier 4 ---------------- */
  {
    id: 'one-hot-key',
    version: 2,
    tier: 4,
    name: 'One whale',
    brief:
      "One customer has grown huge, and half of all asks are now theirs. Accounts are split across four account managers, so every one of the whale's asks lands on the same person. The team reads about half busy, yet 1 in 5 of the 48 asks a week is dropped. Drop no more than 1 in 100, and answer the slowest 1 in 100 within a day and a half. You can add room for 6 more tasks at once, as more people or as more tasks each person juggles.",
    presetId: 'sharded-database',
    startOverrides: { shards: { hotKeyFraction: 0.5 } },
    loadRps: 48,
    budget: 6,
    allowedNewKinds: ['cache'],
    locks: [
      // Who the customers are is not a design decision.
      { kind: 'shard', field: 'hotKeyFraction' },
      // Reassigning every account is a reorganisation, not a setting.
      { kind: 'shard', field: 'shardCount' },
      { kind: 'cache', field: 'hitRate' },
    ],
    goals: [
      { metric: 'p99', max: 300 },
      { metric: 'errorRate', max: 1 },
    ],
    hints: [
      'The team says it is about half busy. Look at the four account managers one at a time, not at the average.',
      "One account manager is carrying far more than their share. You can't choose which customer asks.",
      'Giving every account manager more room costs four tasks for each one you add. Look at the handoff from the support desk to the account managers. How many of those asks need a person at all?',
    ],
    lesson:
      "Splitting accounts spreads the customers, but it can't split one customer, so the whale's account manager was offered about 30 asks a week against the 20 they can clear. A playbook in front of the account managers answered most of those repeated asks before they reached anyone, which brought that person under their limit for a task or two of room. When work is split by owner, watch each owner on their own, because the average can look calm while one person drowns.",
  },
  {
    id: 'saved-then-lost',
    version: 2,
    tier: 4,
    name: 'Promised, then lost',
    brief:
      'Every customer ask comes with paperwork. Deferred paperwork says yes at once, then files it with ops records about a week later. At week 20, ops records slows to an eighth of its pace for ten weeks: about 20 a week cleared against the 40 still arriving. No customer sees a failure, yet over a hundred promises are never recorded. Lose none of them. Also answer the slowest 1 in 100 asks within a day and a half, and drop no more than 2 in 100. There is no budget: you cannot add room for a single task.',
    presetId: 'resilient-delivery',
    loadRps: 46,
    budget: 0,
    faults: [
      {
        atMs: 20_000,
        action: 'inject',
        nodeId: 'db',
        kind: 'slow',
        opts: { factor: 8 },
      },
      { atMs: 30_000, action: 'clear', nodeId: 'db' },
    ],
    goals: [
      { metric: 'p99', max: 300 },
      // Some vendor work fails three times and is abandoned whatever the
      // design, just under 1 in 100.
      { metric: 'errorRate', max: 2 },
      { metric: 'lostWrites', max: 0 },
    ],
    hints: [
      'No customer sees anything wrong, so stop watching them. Follow one piece of paperwork all the way to ops records.',
      "During the slowdown, ops records can't keep up with the paperwork sent to it. Look at what it does with the pieces it has no room for.",
      'Taking out the deferred paperwork makes every customer wait on a slow records team. Look at ops records. Does paperwork filed later need an answer fast, or does it only need to get there?',
    ],
    lesson:
      'Deferred paperwork says yes before the promise is recorded, so anything that goes wrong after that is silent, and the drop rate stays clean while promises disappear. Nobody was waiting on that paperwork, so the fix was to let it wait in line for ops records instead of being turned away when the line filled up. Whenever you say yes before the work is done, the work behind it needs its own room to wait and its own alarm.',
  },
  {
    id: 'loud-and-quiet',
    version: 2,
    tier: 4,
    name: 'Loud and quiet',
    brief:
      'Launch month: 640 customer asks a week, and one whale customer sends half of the asks that reach the account managers. Customers wait days for answers. Behind the scenes, every ticket also logs a feature ask, and the feature backlog is over a thousand deep by the end. Answer the slowest 1 in 100 asks within a day and a half, drop no more than 1 in 100, and leave 100 feature asks or fewer waiting at the end. You can add room for 6 more tasks at once, as more people or as more tasks each person juggles.',
    presetId: 'full-stack',
    // The backlog is never full in this brief, so its depth is the quiet
    // number and never turns into dropped work.
    startOverrides: { shards: { hotKeyFraction: 0.5 }, queue: { queueLimit: 5000 } },
    loadRps: 640,
    budget: 6,
    allowedNewKinds: ['cache'],
    locks: [
      { kind: 'shard', field: 'hotKeyFraction' },
      { kind: 'shard', field: 'shardCount' },
      { kind: 'cache', field: 'hitRate' },
      { kind: 'cdn', field: 'hitRate' },
    ],
    goals: [
      { metric: 'p99', max: 300 },
      { metric: 'errorRate', max: 1 },
      { metric: 'queueDepth', max: 100 },
    ],
    hints: [
      'There are two problems here, and only one of them shows up as slow answers.',
      'One account manager is doing most of the work. Separately, count how many feature asks reach the backlog each week and how many the product engineers finish.',
      "Room for six more tasks won't fix either problem the expensive way. Look at the account managers and the product engineers. What is the smallest change that gets each one under the work it actually gets?",
    ],
    lesson:
      "A company can fail loudly and quietly at once: the whale made answers slow, while the product engineers, finishing about 160 feature asks a week against 190 logged, fell a little further behind every week and the backlog hid it. Fixing only the loud problem meets the speed goals and still leaves a backlog that never drains. Size each team for the work it really gets, and watch the backlog's depth, because customers won't report it.",
  },
];

/** A brief by id, the real incidents' included. */
export function challengeById(id: string): Challenge | undefined {
  return (
    CHALLENGES.find((c) => c.id === id) ?? INCIDENT_BRIEFS.find((c) => c.id === id)
  );
}
