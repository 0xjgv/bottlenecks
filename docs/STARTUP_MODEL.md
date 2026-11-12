# The startup model

Bottlenecks maps the flow of work through a startup the way Breakscale mapped requests through a
system. The engine is unchanged: it is a queueing network, which is exactly what _The Goal_
describes. Work items arrive, wait in line, get worked on by people with limited hands, wait on
other people, get reworked, and sometimes get dropped. Everything in this document is
presentation: names, units and copy. Engine identifiers (`NodeKind` literals, `NodeConfig`
fields) stay as they are, because saved designs, the share format and pinned tests depend on them.

## Time scale

One simulated second is one working week of 40 hours. Constants live in
`src/components/format.ts` (`MS_PER_HOUR = 25`, `MS_PER_DAY = 200`, `MS_PER_WEEK = 1000`).

| Engine          | Reads as                     | Example                           |
| --------------- | ---------------------------- | --------------------------------- |
| 1 ms            | 2.4 working minutes          |                                   |
| 25 ms           | 1 working hour               | a code review: `serviceMs: 25`    |
| 200 ms          | 1 working day (8 hours)      | a small feature: `serviceMs: 200` |
| 1000 ms         | 1 working week               | client `timeoutMs: 1000`          |
| `rps`           | work items arriving per week | `rps: 40` is 40 tickets a week    |
| elapsed seconds | elapsed weeks                | 13 seconds is a quarter           |

A node's ceiling is `capacity * instances * (1000 / serviceMs)` items per week. A team of 4
engineers (`instances: 4`), each working one task at a time (`capacity: 1`), at one day per task
(`serviceMs: 200`) finishes at most 20 tasks a week.

Volumes must land at tens per week or more: the rate window is one week and the bottleneck finder
treats under 0.5 a week as noise. Model work at the grain of tasks, tickets and reviews, not epics.

## Vocabulary

| Engine term                             | Startup term                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| request                                 | work item (task, ticket, lead, review, request)                                   |
| client                                  | where work comes from (customers, sales, the roadmap)                             |
| rps / offered                           | work arriving per week                                                            |
| throughput                              | work finished per week                                                            |
| goodput                                 | work delivered that the requester still wanted                                    |
| latency, p50/p99                        | cycle time: how long from asking to done. p99 = slowest 1 in 100                  |
| instances                               | people (headcount)                                                                |
| capacity / slots                        | tasks one person juggles at once (work in progress per person)                    |
| serviceMs                               | hands-on time per item                                                            |
| serviceCv                               | how uneven the work is                                                            |
| queue / queueLimit                      | backlog, and the most that can sit in it before work is dropped                   |
| utilisation                             | how busy people are                                                               |
| error / errorRate                       | work that fails or bounces (bugs, rejected, wrong)                                |
| timeoutMs                               | how long the requester waits before giving up (churns, escalates, goes elsewhere) |
| retries                                 | how many times they chase or resubmit                                             |
| holding a slot while waiting downstream | blocked: a person holds the task while waiting on someone else                    |

## Components

Each kind keeps its behaviour. The name is the startup job that fails the same way.

| Kind         | Name               | Why it fails the same way                                                                                                            |
| ------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| client       | Incoming work      | Offers work at a rate and gives up after a deadline.                                                                                 |
| lb           | Dispatcher         | A lead spreading work across people. Nearly free, until it is not.                                                                   |
| service      | Team               | People who hold a task while waiting on what they asked others for.                                                                  |
| cache        | Playbook           | Answers a share of asks with no person involved (docs, templates, FAQ).                                                              |
| db           | Decision maker     | The founder or approver everyone waits on; decisions conflict and queue (lock wait), and adding helpers does not fix it.             |
| queue        | Backlog            | Async handoff: the sender moves on, work waits for whoever pulls it.                                                                 |
| worker       | Ticket crew        | People pulling from a backlog at their own pace.                                                                                     |
| replica      | Deputies           | Answer questions on the owner's behalf, but are behind on the latest context (lag = stale answers). Decisions still go to the owner. |
| shard        | Split ownership    | Accounts or areas split between owners; one huge customer (hot key) lands on one owner.                                              |
| autoscaler   | Hiring plan        | Adds headcount when a team runs hot. Warm-up is hiring plus onboarding, so help always arrives late.                                 |
| region       | Backup owner       | One owner at a time; when they are out, handover takes time.                                                                         |
| cdn          | Help center        | Public self-serve that deflects asks before they reach anyone.                                                                       |
| ratelimiter  | Intake limit       | Admits a fixed number of new items a week and refuses the rest.                                                                      |
| breaker      | Stop-the-line rule | After repeated failures from a partner, stop sending work there for a while.                                                         |
| objectstore  | Shared drive       | Slow flat cost per lookup, wide enough not to saturate.                                                                              |
| searchindex  | Internal search    | Finding prior work is cheap; recording it costs more and shows up late.                                                              |
| timeseriesdb | Metrics tracker    | Logging numbers is cheap, a report costs hundreds of entries.                                                                        |
| graphdb      | Cross-team lookup  | Every extra team you have to ask multiplies the cost.                                                                                |
| coldstorage  | Archive            | Cheap to keep, slow to dig out.                                                                                                      |
| vectordb     | AI assistant       | Answers by similarity; accuracy costs time.                                                                                          |
| streambroker | Team channel       | Posts are instant; each reader group falls behind at its own pace.                                                                   |
| pubsub       | Announcement       | One message becomes work for every team that hears it.                                                                               |
| websocket    | Standing meetings  | Capacity is people in the room, held for the whole meeting.                                                                          |
| apigateway   | Front desk         | Checks, limits and routes each ask to the right team.                                                                                |
| sidecar      | Process step       | A tax on every item (status updates, compliance), with retries and deadlines.                                                        |
| lambda       | Contractors        | Scale up on demand to a cap, but each new one needs ramp-up time (cold start).                                                       |
| cron         | Recurring ritual   | Planning, reporting, payroll: a batch of work dropped all at once on a schedule.                                                     |
| bulkhead     | Reserved capacity  | Caps work outstanding to one dependency, so one slow partner cannot eat everyone's time.                                             |
| retryqueue   | Rework queue       | Failed work comes back later; what fails every time is abandoned.                                                                    |
| transcoder   | Production studio  | Long specialist jobs (design, video, content).                                                                                       |
| edgecompute  | First-touch fix    | Frontline resolves a share of asks at first contact.                                                                                 |
| writebehind  | Deferred paperwork | Say yes now, record it later. If the person leaves, the unrecorded yeses are lost.                                                   |
| loadshedder  | Priority triage    | Under load, drop low-priority work first so what matters keeps moving.                                                               |

## Things that halt a startup

The fault controls and the stress test are the "what could go wrong" tool.

| Fault          | Startup event                                               |
| -------------- | ----------------------------------------------------------- |
| crash          | A whole team or person is out (leave, quit, offsite)        |
| crash-instance | One person is out sick                                      |
| slow           | Someone slows down (context switching, burnout, a new hire) |
| errors         | Quality slips: work bounces back                            |
| cut            | A handoff breaks: messages get lost between two teams       |
| traffic spike  | A launch, a big customer, a press hit                       |

## Seeing ahead

"What if we grow?" (`src/learn/growth.ts`) plays the design for 20 weeks at 1x, 1.5x, 2x, 3x and
4x today's incoming work and measures, per multiple, work finished a week, the share lost (dropped,
given up on, or promised and then lost), the slowest 1 in 100 cycle time, and the constraint. The
constraint is the step "Find the problem" names, so the two never disagree; when nothing is piling
up, the busiest step stands in as the likely next constraint. A multiple counts as broken when more
than 2 in 100 items are lost or the slowest cycle time more than doubles.
