# systemdesignftw.md

**Project:** Fo The Win (FTW)
**Type:** Real-time competitive and solo math problem-solving game
**Owner:** Markandeya Yalamanchi
**Doc status:** Build spec, v1. This is the source of truth for the orchestrating coding agent.

---

## 0. How the coding agent should use this document

You are the orchestrating agent. Read this entire file before writing any code. Your job:

1. Set up the repo scaffold per Section 16.
2. Dispatch sub-agents per the plan in Section 17. The two largest parallel workstreams are the **problem bank generation** (Section 10) and the **app build** (Sections 11 to 15).
3. Sequence the work by the milestones in Section 18.
4. Stop at every checkpoint marked `HUMAN CHECKPOINT` in Section 19. Do not attempt to provision Vercel, Supabase, OAuth, or any external service without first prompting the user with the exact information requested at that checkpoint. Provisioning silently will break the build and waste credentials.

Rules of engagement:

- The target repo is an empty GitHub repo the user will provide. Assume monorepo, single Next.js app plus a `content/` problem pipeline, unless the user says otherwise at the first checkpoint.
- Never commit secrets. All credentials go in `.env.local` and Vercel/Supabase dashboards. Section 20 lists every variable.
- Every generated problem must be machine-checkable and pass the validator in Section 10.6 before it enters the bank. Reject anything that does not.
- Where this doc says "confirm with user," pause and prompt. Do not guess on billing, region, or auth-provider decisions.

---

## 1. Product overview

Fo The Win is a math game modeled on the Art of Problem Solving "For The Win" format, built around the full topic set of AoPS *Introduction to Algebra* (Rusczyk, 2nd ed.). Players answer competition-style problems under a timer, alone or head to head, and earn points for speed and accuracy.

Two entry paths chosen on the first screen:

- **Solo:** practice any topic set at any difficulty, against the clock and against optional bots. Feeds streak, XP, and per-topic mastery.
- **Multiplayer:** create or join a party, configure a match, and compete in real time on a shared question stream.

A dedicated **Speed Multiplication Race** tab exists outside the algebra topic tree, with its own solo and multiplayer flows.

Design goals: sub-100ms perceived input latency in a round, authoritative server-side timing and scoring for multiplayer so speed cannot be spoofed, and a problem bank large enough that a player rarely repeats a question inside a session.

---

## 2. Glossary

- **Topic:** a leaf node in the taxonomy (Section 6), e.g. `alg.quadratics.completing_the_square`. Maps to one AoPS section.
- **Topic group:** a chapter, e.g. `alg.quadratics_2`.
- **Round:** one question shown to all players in a session with a single authoritative timer.
- **Session:** one full game, made of N rounds, in one mode.
- **Party / room:** a lobby of users identified by a short join code, from which sessions are launched.
- **Bank:** the stored set of pre-generated, validated problems.
- **Complexity factor:** a per-problem multiplier (0.6 to 1.6) that scales the base time for its difficulty.
- **Mastery:** per-user, per-topic rolling proficiency estimate (0 to 100).
- **Rating:** per-user competitive Elo, global and optionally per topic group.

---

## 3. Screen flow and navigation

```
Splash / Auth
   |
   v
Home  ->  [ SOLO ]  or  [ MULTIPLAYER ]  or  [ SPEED MULT RACE ]  or  [ PROFILE ]
                 |                |                     |
                 v                v                     v
        Solo Config       Party Lobby            Race Config
                 |                |                     |
                 v                v                     v
        Solo Session      MP Session             Race Session
                 |                |                     |
                 v                v                     v
        Results ---------> Rematch / Home <---------- Results
```

First interactive screen after auth is **Home**, which surfaces four choices: Solo, Multiplayer, Speed Multiplication Race, Profile. The Solo vs Multiplayer split the user described happens here. Every game type has a Solo mode reachable without any other player.

Screens to build (Section 14 details components):

1. **Splash / Auth** — sign in, sign up, guest mode. Guest gets a local temp profile that can be claimed later.
2. **Home** — mode tiles, current streak badge, rating, daily challenge entry point.
3. **Solo Config** — topic picker (multi-select tree), difficulty (Easy/Medium/Hard), round count, optional bot opponents, timer preview.
4. **Party Lobby** — create room (returns join code + link) or join by code; host sees config controls, players see ready toggles; live presence list.
5. **Match Config (host only)** — same controls as Solo Config plus ranked/casual toggle and per-round or fixed-timer options.
6. **Session (Solo, MP, Race)** — question canvas, timer ring, answer input, live scoreboard (MP), reveal/solution panel.
7. **Results** — final scoreboard, per-round breakdown, rating/streak/XP deltas, rematch and share buttons.
8. **Profile** — stats, mastery heatmap across topics, streak calendar, achievements, match history, settings.
9. **Speed Multiplication Race Config + Session** — range settings, mode (sprint vs first-to-N), solo or MP.

---

## 4. Game modes

### 4.1 Solo (algebra topics)
- Player selects topics, difficulty, round count (default 10, options 5/10/20/endless).
- Client-authoritative timing is acceptable here since nothing competitive is at stake, but still record real elapsed time.
- Optional bots: simulated opponents with a target accuracy and answer-time distribution per difficulty. Bots exist to make solo feel like FTW without needing peers. Bot behavior spec in Section 8.4.
- Outcomes update streak, XP, and mastery. Solo does not affect competitive rating.

### 4.2 Multiplayer / party
- Host creates a room, shares a 6-character join code and link.
- 2 to 8 players. Presence tracked live.
- Host picks topics, difficulty, round count, ranked or casual.
- Server-authoritative: server picks each problem, stamps the round start, validates every submission's timestamp, and computes points. Clients never self-report score.
- Ranked matches update Elo (Section 8.3). Casual does not.
- Late join allowed only in lobby, not mid-session, in v1.

### 4.3 Speed Multiplication Race
- Separate tab, not part of the algebra tree.
- Problems generated procedurally at runtime, no bank storage.
- Config: factor range (default 2 to 12, options up to 2-digit x 2-digit), mode:
  - **Sprint:** most correct in a fixed window (default 60s).
  - **First to N:** race to N correct (default 20), lowest time wins.
- Solo and multiplayer both supported. Multiplayer uses the same session engine and scoreboard; each player gets the same seeded problem sequence so the race is fair.
- Has its own leaderboard and its own streak-independent stat block on the profile.

---

## 5. Difficulty and timing model

Three difficulties: Easy, Medium, Hard. Time per question is derived, not hand-set per problem.

```
time_seconds = base_time[difficulty] * complexity_factor(problem)
```

Base times:

| Difficulty | Base time (s) |
|-----------|---------------|
| Easy      | 25            |
| Medium    | 45            |
| Hard      | 75            |

`complexity_factor` is a field on each problem, in [0.6, 1.6], default 1.0. Generation agents set it so that mechanically long topics (telescoping series, completing the square, multi-step word problems) get more time than fast-recognition topics (order of operations, evaluating expressions) at the same difficulty. Recommended anchors:

| Topic band | Suggested complexity factor |
|-----------|------------------------------|
| Order of ops, expressions, single-step eval | 0.7 to 0.9 |
| Linear equations, ratios, percents, basic factoring | 0.9 to 1.1 |
| Quadratics, functions, graphing, inequalities | 1.0 to 1.3 |
| Logs, sequences/series, special manipulations, multi-step word problems | 1.2 to 1.6 |

Difficulty rubric the generation agents must follow (per topic, calibrated to AoPS level):

- **Easy:** one concept, one or two steps, clean numbers, answer often an integer or simple fraction. A student who just read the section can do it.
- **Medium:** two or three steps, may combine the section's concept with a prerequisite, mild casework or a non-obvious setup.
- **Hard:** AoPS "starred exercise" / Challenge Problem flavor. Multi-step, requires insight or a clever manipulation, may combine two topics from the same chapter. Should not require topics from later chapters than the problem's own.

The timer for a round in MP is `time_seconds` from the selected problem, rounded to the nearest second, minimum 8s. In Race mode the timer is the mode window, not per-problem.

---

## 6. Topic taxonomy

Every AoPS section becomes a topic leaf. Summary sections are not generated as content; they become **Mixed Review** sets that draw from all leaves in their chapter. IDs are stable and used as foreign keys in the bank and in stats.

Format: `group_id` / `topic_id` / display name / source section.

### Group `ch1_rules` — Follow the Rules
- `ch1.numbers` — Numbers — 1.1
- `ch1.order_of_ops` — Order of Operations — 1.2
- `ch1.when_order_matters` — When Does Order Matter — 1.3
- `ch1.distribution_factoring` — Distribution and Factoring — 1.4
- `ch1.equations` — Equations — 1.5
- `ch1.exponents` — Exponents — 1.6
- `ch1.fractional_exponents` — Fractional Exponents — 1.7
- `ch1.radicals` — Radicals — 1.8

### Group `ch2_x_marks_spot` — x Marks the Spot
- `ch2.expressions` — Expressions — 2.1
- `ch2.arithmetic_expressions` — Arithmetic with Expressions — 2.2
- `ch2.dist_sub_factor` — Distribution, Subtraction, and Factoring — 2.3
- `ch2.fractions` — Fractions — 2.4

### Group `ch3_one_var_linear` — One-Variable Linear Equations
- `ch3.solving_linear_1` — Solving Linear Equations I — 3.1
- `ch3.solving_linear_2` — Solving Linear Equations II — 3.2
- `ch3.word_problems` — Word Problems — 3.3
- `ch3.linear_in_disguise` — Linear Equations in Disguise — 3.4 (starred)

### Group `ch4_more_variables` — More Variables
- `ch4.eval_multivar` — Evaluating Multi-Variable Expressions — 4.1
- `ch4.more_arithmetic` — Still More Arithmetic — 4.2
- `ch4.distribution_factoring` — Distribution and Factoring — 4.3
- `ch4.fractions` — Fractions — 4.4
- `ch4.equations` — Equations — 4.5

### Group `ch5_multivar_linear` — Multi-Variable Linear Equations
- `ch5.intro_two_var` — Introduction to Two-Variable Linear Equations — 5.1
- `ch5.substitution` — Substitution — 5.2
- `ch5.elimination` — Elimination — 5.3
- `ch5.word_problems` — Word Problems — 5.4
- `ch5.more_disguise` — More Linear Equations in Disguise — 5.5
- `ch5.more_variables` — More Variables — 5.6

### Group `ch6_ratios_percents` — Ratios and Percents
- `ch6.basic_ratio` — Basic Ratio Problems — 6.1
- `ch6.challenging_ratio` — More Challenging Ratio Problems — 6.2
- `ch6.conversion_factors` — Conversion Factors — 6.3
- `ch6.percent` — Percent — 6.4
- `ch6.percentage_problems` — Percentage Problems — 6.5

### Group `ch7_proportion` — Proportion
- `ch7.direct` — Direct Proportion — 7.1
- `ch7.inverse` — Inverse Proportion — 7.2
- `ch7.joint` — Joint Proportion — 7.3
- `ch7.rate` — Rate Problems — 7.4

### Group `ch8_graphing_lines` — Graphing Lines
- `ch8.number_line_plane` — The Number Line and the Cartesian Plane — 8.1
- `ch8.intro_graphing_linear` — Introduction to Graphing Linear Equations — 8.2
- `ch8.slope_in_problems` — Using Slope in Problems — 8.3
- `ch8.find_equation` — Find the Equation — 8.4
- `ch8.slope_intercepts` — Slope and Intercepts — 8.5
- `ch8.comparing_lines` — Comparing Lines — 8.6

### Group `ch9_inequalities` — Introduction to Inequalities
- `ch9.basics` — The Basics — 9.1
- `ch9.which_greater` — Which Is Greater — 9.2
- `ch9.linear_inequalities` — Linear Inequalities — 9.3
- `ch9.graphing_inequalities` — Graphing Inequalities — 9.4
- `ch9.optimization` — Optimization — 9.5

### Group `ch10_quadratics_1` — Quadratic Equations Part 1
- `ch10.getting_started` — Getting Started With Quadratics — 10.1
- `ch10.factoring_1` — Factoring Quadratics I — 10.2
- `ch10.factoring_2` — Factoring Quadratics II — 10.3
- `ch10.sums_products_roots` — Sums and Products of Roots — 10.4
- `ch10.extensions` — Extensions and Applications — 10.5 (starred)

### Group `ch11_special_factorizations` — Special Factorizations
- `ch11.squares_binomials` — Squares of Binomials — 11.1
- `ch11.difference_squares` — Difference of Squares — 11.2
- `ch11.sum_diff_cubes` — Sum and Difference of Cubes — 11.3
- `ch11.rationalizing` — Rationalizing Denominators — 11.4
- `ch11.sfft` — Simon's Favorite Factoring Trick — 11.5

### Group `ch12_complex` — Complex Numbers
- `ch12.more_numbers` — Numbers, Numbers, and More Numbers — 12.1
- `ch12.imaginary` — Imaginary Numbers — 12.2
- `ch12.complex` — Complex Numbers — 12.3

### Group `ch13_quadratics_2` — Quadratic Equations Part 2
- `ch13.squares_binomials_revisited` — Squares of Binomials Revisited — 13.1
- `ch13.completing_square` — Completing the Square — 13.2
- `ch13.quadratic_formula` — The Quadratic Formula — 13.3
- `ch13.applications` — Applications and Extensions — 13.4 (starred)

### Group `ch14_graphing_quadratics` — Graphing Quadratics
- `ch14.parabolas` — Parabolas — 14.1
- `ch14.circles` — Circles — 14.2

### Group `ch15_more_inequalities` — More Inequalities
- `ch15.quadratic_inequalities` — Quadratic Inequalities — 15.1
- `ch15.beyond_quadratics` — Beyond Quadratics — 15.2
- `ch15.trivial_inequality` — The Trivial Inequality — 15.3
- `ch15.quadratic_optimization` — Quadratic Optimization — 15.4 (starred)

### Group `ch16_functions` — Functions
- `ch16.the_machine` — The Machine — 16.1
- `ch16.combining` — Combining Functions — 16.2
- `ch16.composition` — Composition — 16.3
- `ch16.inverse` — Inverse Functions — 16.4
- `ch16.problem_solving` — Problem Solving with Functions — 16.5
- `ch16.operations` — Operations — 16.6

### Group `ch17_graphing_functions` — Graphing Functions
- `ch17.basics` — Basics — 17.1
- `ch17.transformations` — Transformations — 17.2
- `ch17.inverse_revisited` — Inverse Functions Revisited — 17.3

### Group `ch18_polynomials` — Polynomials
- `ch18.add_subtract` — Addition and Subtraction — 18.1
- `ch18.multiplication` — Multiplication — 18.2

### Group `ch19_exp_logs` — Exponents and Logarithms
- `ch19.exponential_functions` — Exponential Functions — 19.1
- `ch19.show_me_money` — Show Me the Money — 19.2
- `ch19.interest` — Interest-ing Problems — 19.3
- `ch19.logarithm` — What is a Logarithm — 19.4

### Group `ch20_special_functions` — Special Functions
- `ch20.radicals` — Radicals — 20.1
- `ch20.absolute_value` — Absolute Value — 20.2
- `ch20.floor_ceiling` — Floor and Ceiling — 20.3
- `ch20.rational_functions` — Rational Functions — 20.4
- `ch20.piecewise` — Piecewise Defined Functions — 20.5

### Group `ch21_sequences_series` — Sequences and Series
- `ch21.arithmetic_sequences` — Arithmetic Sequences — 21.1
- `ch21.arithmetic_series` — Arithmetic Series — 21.2
- `ch21.geometric_sequences` — Geometric Sequences — 21.3
- `ch21.geometric_series` — Geometric Series — 21.4
- `ch21.telescoping` — Telescoping — 21.5 (starred)

### Group `ch22_special_manipulations` — Special Manipulations
- `ch22.raising_powers` — Raising Equations to Powers — 22.1
- `ch22.self_similarity` — Self-similarity — 22.2
- `ch22.symmetry` — Symmetry — 22.3

### Special (outside the tree)
- `race.multiplication` — Speed Multiplication Race — procedural, no bank

**Mixed Review sets:** for each `chN`, expose a virtual topic `chN.mixed` that samples across the group's leaves. These are not stored; they are query filters.

Total content leaves: 86. At the volume target in Section 10.5 this yields a large bank; see that section for the math.

---

## 7. Scoring, rating, streaks

### 7.1 Round scoring (MP and solo)
Points for a correct answer:

```
speed_points = round(1000 * remaining_fraction)      # remaining_fraction in [0,1]
base_points  = 500
round_points = base_points + speed_points            # correct
             = 0                                       # wrong or timeout (casual)
             = -100                                    # wrong (ranked, optional penalty)
```

`remaining_fraction = time_left_ms / total_time_ms` at submission, clamped to [0,1], computed on the server for MP. A correct answer at the last instant still earns the 500 base. A near-instant correct answer approaches 1500.

Optional first-solve bonus in MP: +200 to the first correct submitter per round. Configurable, default on for casual, off for ranked to reduce input-lag unfairness.

### 7.2 Session score
Sum of round points. Ties broken by total time on correct answers (lower wins), then by correct count.

### 7.3 Rating (Elo, ranked MP only)
- Global Elo per user, start 1200, K=32 for <30 games then K=16.
- Multiplayer with >2 players: compute pairwise expected scores against each opponent using final placement, apply the average delta. Standard multiplayer Elo aggregation.
- Optional per-group Elo for finer matchmaking later; store the scaffold but v1 can leave per-group rating null.

### 7.4 Streaks
- Daily streak: increments once per calendar day (user local timezone) in which the user completes at least one session of any mode, including a Race.
- `current_streak`, `longest_streak`, `last_played_date`.
- Freeze tokens: user earns 1 freeze per 7-day streak, max 2 banked. A missed day consumes a freeze instead of resetting. Purely retention mechanic, no payment.
- Streak evaluated server-side at session finalize to prevent clock spoofing.

### 7.5 XP and levels
- XP per correct answer scaled by difficulty (Easy 10, Medium 20, Hard 35) plus a session-completion bonus.
- Level curve: `xp_for_level(n) = 100 * n * (n+1) / 2`. Levels are cosmetic and unlock avatar frames/titles.

### 7.6 Mastery (per user, per topic)
- Rolling estimate 0 to 100. Update after each attempt:
  `mastery += learning_rate * (outcome - mastery/100)` where outcome is 1 for correct, 0 for wrong, learning_rate scales down with attempt count (start 8, floor 2). Speed can nudge outcome up to 1.1 for fast-correct.
- Drives the profile heatmap and can seed adaptive difficulty later.

---

## 8. Players, bots, matchmaking

### 8.1 Profile / save data (what persists)
- Identity: user id, username, display name, avatar, title, created_at.
- Progression: xp, level, global rating, per-group rating (nullable v1).
- Streak block: current, longest, last_played_date, freeze_tokens.
- Per-topic stats: attempts, correct, avg_time_ms, mastery.
- Settings: sound, theme, LaTeX render size, default topic/difficulty presets, timezone.
- History: match history rows, race personal bests.
- Achievements: unlocked set with timestamps.
- Guest data lives in localStorage under a `guest_profile` key and is migrated to a real row on claim.

### 8.2 Achievements (starter set, extend freely)
- First Win, 7-Day Streak, 30-Day Streak, 100 Problems Solved, Perfect Session, Sub-5s Solve, Master of a Group (all leaves in a chapter at mastery >= 80), Race Demon (Race PB under a threshold), Comeback (win from last place at final round).

### 8.3 Matchmaking (v1 minimal)
- v1: party-code based, no open matchmaking queue. Ranked still updates Elo among party members.
- v2 hook: an open queue that buckets by global Elo. Leave the interface stubbed.

### 8.4 Bots (solo only)
- A bot has `target_accuracy` and an answer-time distribution per difficulty.
- Suggested profiles: Rookie (acc 0.55, slow), Regular (0.75, medium), Sharp (0.9, fast).
- Bot answer time sampled from a truncated normal within the round timer; on "correct" it submits the right answer, on "incorrect" it submits a random distractor.
- Bots never affect rating or streak; they are pacing tools.

---

## 9. Real-time multiplayer protocol

Transport: **Supabase Realtime** channels per room, using Presence for the lobby roster and Broadcast for game events. Authoritative scoring and problem selection run in **Supabase Edge Functions**; the channel carries signals, the database holds truth.

Channel: `room:{code}`

Presence payload: `{ user_id, display_name, avatar, ready, is_host }`

Broadcast events (server or host-emitted; clients treat DB as source of truth on scores):

| Event | Emitter | Payload |
|-------|---------|---------|
| `lobby_update` | any | roster diff |
| `config_update` | host | match config |
| `game_start` | edge fn | session_id, round_count |
| `round_start` | edge fn | round_index, problem (no answer), server_start_ts, duration_ms |
| `answer_ack` | edge fn | to submitter only: accepted, time_ms |
| `round_reveal` | edge fn | correct_answer, solution, per-player results, scoreboard |
| `game_end` | edge fn | final scoreboard, rating/xp/streak deltas |

Anti-cheat essentials:
- The correct answer is never sent to clients before `round_reveal`.
- Submission time is measured server-side from `server_start_ts`, not from client clocks.
- Edge function rejects submissions after `server_start_ts + duration_ms + network_grace` (grace default 500ms).
- One scored submission per player per round.
- Problem selection is server-side; clients receive only prompt and choices.

Edge functions:
- `start_match(session_id)` — validates host, locks config, selects the round problem set, writes rounds, emits `game_start`.
- `start_round(session_id, round_index)` — sets authoritative start ts, emits `round_start`.
- `submit_answer(session_id, round_index, answer)` — validates timing and correctness, writes `round_answers`, returns ack.
- `finalize_round(session_id, round_index)` — computes points, emits `round_reveal`.
- `finalize_match(session_id)` — updates ratings, xp, streaks, mastery, match history, emits `game_end`.

Round pacing can be host-clock driven (host calls `start_round` and `finalize_round` on a loop) or fully server-scheduled. v1: host-driven with edge-function authority on scoring. Note this decision at the architecture checkpoint.

---

## 10. Problem bank specification

This is the largest content workstream. Sub-agents generate problems per topic per difficulty, then a validator gates them into the bank.

### 10.1 Storage
Problems live in two places:
- **Source of truth:** JSON files under `content/problems/{group_id}/{topic_id}.{difficulty}.json`, one array per file. This is what generation agents write and what humans can review in PRs.
- **Runtime:** a `problems` table in Supabase, loaded by a seed script (`content/seed.ts`) that reads the JSON, re-runs the validator, and upserts by `checksum`.

Keeping JSON as source of truth means the bank is diffable, reviewable, and re-seedable without regenerating.

### 10.2 Problem JSON schema

```json
{
  "id": "ch10.factoring_1.medium.0007",
  "topic_id": "ch10.factoring_1",
  "group_id": "ch10_quadratics_1",
  "difficulty": "medium",
  "prompt_latex": "Factor completely: $x^2 - 7x + 12$.",
  "answer_format": "mc",
  "choices": [
    { "id": "a", "latex": "$(x-3)(x-4)$" },
    { "id": "b", "latex": "$(x+3)(x+4)$" },
    { "id": "c", "latex": "$(x-2)(x-6)$" },
    { "id": "d", "latex": "$(x-1)(x-12)$" }
  ],
  "correct_choice": "a",
  "correct_answer": "(x-3)(x-4)",
  "answer_type": "expression",
  "accepted_forms": ["(x-4)(x-3)"],
  "solution_latex": "We need two numbers with product $12$ and sum $-7$: $-3$ and $-4$. So $x^2-7x+12=(x-3)(x-4)$.",
  "complexity_factor": 1.0,
  "source_section": "10.2",
  "tags": ["factoring", "quadratic"],
  "checksum": "sha256-...",
  "status": "valid"
}
```

Notes:
- `answer_format`: `"mc"` (multiple choice, default for competitive fairness) or `"numeric"` / `"exact"` for free-entry solo practice. Generate MC as primary. For every problem also fill `correct_answer` and `answer_type` so a free-entry variant can be derived.
- `answer_type`: one of `integer`, `fraction`, `decimal`, `expression`, `ordered_pair`, `set`, `interval`, `boolean`, `string`.
- `accepted_forms`: alternate canonical strings the normalizer should treat as correct.
- `checksum`: sha256 of `topic_id + difficulty + prompt_latex + correct_answer`, used for dedupe and idempotent seeding.

### 10.3 Answer normalization (for free-entry / validation)
Provide a `normalizeAnswer(input, answer_type)` utility used both by the validator and by free-entry solo mode:
- integer/decimal: strip whitespace, normalize sign, parse number, compare with tolerance 1e-9.
- fraction: reduce to lowest terms, compare numerator/denominator.
- expression: parse with a CAS-lite (use `mathjs` or `nerdamer`) and check symbolic equality where feasible; otherwise fall back to `accepted_forms` string match after canonicalizing spacing and factor order.
- ordered_pair / set / interval: parse structure, compare element-wise (set is order-insensitive).
For MC, correctness is just `choice === correct_choice`, so MC is the safe default for real-time play. Free-entry is a solo convenience.

### 10.4 Distractor rules (MC)
Each MC problem has exactly one correct choice and 3 distractors. Distractors must be **plausible wrong answers a student would actually produce**, not random. Required distractor archetypes to draw from per topic:
- Sign error (dropped or flipped negative).
- Off-by-one or arithmetic slip.
- Applied the operation in the wrong order or to the wrong term.
- Correct method, incomplete (stopped a step early).
- Common misconception specific to the topic (e.g., distributing an exponent over a sum, `(a+b)^2 = a^2+b^2`).
No "None of the above" or "All of the above." Shuffle choice order at seed time and store the shuffled order; do not let the correct answer land in a fixed slot.

### 10.5 Volume targets
Per topic leaf, per difficulty: **minimum 50, target 60**. Mixed Review is virtual (no storage).

```
86 leaves * 3 difficulties * 50 = 12,900 problems (floor)
86 leaves * 3 difficulties * 60 = 15,480 problems (target)
```

Race mode adds 0 stored problems (procedural). Confirm the target multiplier with the user at the content checkpoint; 50 is the floor for "rarely repeats in a session."

### 10.6 Validator (gate before a problem enters the bank)
Every problem must pass all checks or it is rejected and regenerated:
1. Schema valid (all required fields, correct enum values).
2. `prompt_latex` and all `latex` fields compile under KaTeX in strict mode (run KaTeX in Node during validation).
3. Exactly one `correct_choice` for MC; `correct_choice` is present in `choices`.
4. The stated correct answer is actually correct: run an independent checker. For algebra this means a symbolic/numeric verification (substitute, expand, or evaluate with `mathjs`/`nerdamer`) rather than trusting the generator. If the checker cannot verify, mark `status: "needs_review"` and exclude from runtime.
5. Distractors are distinct from each other and from the correct answer, and each is itself a well-formed value of `answer_type`.
6. `complexity_factor` in [0.6, 1.6].
7. No duplicate `checksum` in the bank.
8. Difficulty sanity: the problem does not require topics from a later chapter than its own (heuristic tag check plus generation-prompt constraint).

Output a validation report at `content/reports/validation.json` with pass/fail counts per topic and a list of rejected items with reasons.

---

## 11. Data model (Supabase / Postgres)

Enable RLS on every user-data table. `problems` is public-readable, service-write only.

```sql
-- Profiles (1:1 with auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  display_name text,
  avatar text,
  title text,
  rating int not null default 1200,
  xp bigint not null default 0,
  level int not null default 1,
  timezone text default 'UTC',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Streaks
create table streaks (
  user_id uuid primary key references profiles(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_played_date date,
  freeze_tokens int not null default 0
);

-- Per-topic stats
create table user_topic_stats (
  user_id uuid references profiles(id) on delete cascade,
  topic_id text not null,
  attempts int not null default 0,
  correct int not null default 0,
  avg_time_ms int not null default 0,
  mastery numeric(5,2) not null default 0,
  primary key (user_id, topic_id)
);

-- Problem bank
create table problems (
  id text primary key,
  topic_id text not null,
  group_id text not null,
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  prompt_latex text not null,
  answer_format text not null check (answer_format in ('mc','numeric','exact')),
  choices jsonb,
  correct_choice text,
  correct_answer text not null,
  answer_type text not null,
  accepted_forms jsonb not null default '[]',
  solution_latex text not null,
  complexity_factor numeric(3,2) not null default 1.0,
  source_section text,
  tags jsonb not null default '[]',
  checksum text unique not null,
  status text not null default 'valid'
);
create index on problems (topic_id, difficulty);

-- Sessions
create table game_sessions (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('solo','mp','race')),
  ranked boolean not null default false,
  host_id uuid references profiles(id),
  room_code text,
  config jsonb not null,
  state text not null default 'lobby',
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table session_players (
  session_id uuid references game_sessions(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  score int not null default 0,
  correct_count int not null default 0,
  total_time_ms int not null default 0,
  placement int,
  primary key (session_id, user_id)
);

create table session_rounds (
  session_id uuid references game_sessions(id) on delete cascade,
  round_index int not null,
  problem_id text references problems(id),
  server_start_ts timestamptz,
  duration_ms int not null,
  primary key (session_id, round_index)
);

create table round_answers (
  session_id uuid references game_sessions(id) on delete cascade,
  round_index int not null,
  user_id uuid references profiles(id) on delete cascade,
  submitted text,
  is_correct boolean not null default false,
  time_ms int,
  points int not null default 0,
  primary key (session_id, round_index, user_id)
);

-- Rooms / parties
create table rooms (
  code text primary key,
  host_id uuid references profiles(id) on delete cascade,
  status text not null default 'open',
  config jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Ratings log (for auditing Elo changes)
create table rating_events (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  session_id uuid references game_sessions(id),
  delta int not null,
  new_rating int not null,
  created_at timestamptz not null default now()
);

-- Achievements
create table achievements (
  key text primary key,
  name text not null,
  description text
);
create table user_achievements (
  user_id uuid references profiles(id) on delete cascade,
  achievement_key text references achievements(key),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_key)
);

-- Speed multiplication race scores
create table race_scores (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  mode text not null check (mode in ('sprint','first_to_n')),
  config jsonb not null,
  correct int not null,
  duration_ms int not null,
  created_at timestamptz not null default now()
);
```

RLS summary (implement policies):
- `profiles`: user can read all (public leaderboard needs it), write only own row.
- `streaks`, `user_topic_stats`, `user_achievements`, `race_scores`: user reads own; writes only via edge functions (service role) at finalize.
- `problems`: anyone authenticated can read `status='valid'`; no client writes.
- `game_sessions`, `session_players`, `session_rounds`, `round_answers`: readable by session participants; writes via edge functions only.
- `rooms`: host writes, participants read.

### Config the human must confirm before schema is applied
- Guest mode: do guests get a real `auth.users` row via anonymous sign-in, or a purely local profile until claim? Recommend Supabase anonymous auth for clean joins. Confirm at the Supabase checkpoint.

---

## 12. Backend architecture

- **Supabase** provides Postgres, Auth, Realtime, Edge Functions, Storage (avatars).
- **Auth:** email/password plus at least one OAuth provider (Google recommended) plus anonymous (guest). Provider setup is a human checkpoint.
- **Edge Functions** hold all authoritative game logic (Section 9). They run with the service role and are the only writers to score/rating/streak tables.
- **Realtime** carries lobby presence and round signals only.
- **Row Level Security** enforces read scoping.
- **Seed script** (`content/seed.ts`) loads the validated bank into `problems`.

Why not a standalone WebSocket game server: for 2 to 8 player turn-based-ish rounds, Supabase Realtime plus Edge Functions is sufficient and keeps the stack on two providers. If later you need sub-round streaming or 100+ concurrent rooms per node, revisit with a dedicated Node/Deno socket server. Flag this as a v2 consideration.

---

## 13. Game session state machine

```
LOBBY
  -> (host starts) COUNTDOWN
COUNTDOWN (3-2-1)
  -> QUESTION_ACTIVE
QUESTION_ACTIVE (timer running, accepting submissions)
  -> (timer end or all answered) QUESTION_REVEAL
QUESTION_REVEAL (show answer + solution + scoreboard, short dwell)
  -> QUESTION_ACTIVE (if rounds remain)
  -> RESULTS (if last round)
RESULTS
  -> LOBBY (rematch) | HOME (exit)
```

Solo runs the same machine with a single player and no network authority. Race replaces the per-round loop with a single continuous timer (sprint) or a running counter (first-to-N), but reuses LOBBY, RESULTS, and the scoreboard component.

Client state: use a state store (Zustand recommended) with a `sessionMachine` reducer mirroring the above. Never advance state on the client for MP without the corresponding server event; the client machine is a projection of server truth.

---

## 14. Frontend architecture

Stack:
- **Next.js (App Router), React, TypeScript.**
- **Tailwind** for styling. Read `/mnt/skills/public/frontend-design` conventions if building in this environment; otherwise apply a clean, high-contrast game UI with a distinct visual identity (not default-looking).
- **KaTeX** for all math rendering. Never render math as plain text.
- **Zustand** for client state, **TanStack Query** for server reads, **Supabase JS client** for auth/realtime.
- **Framer Motion** for timer ring, reveal transitions, scoreboard animation.

Key components:
- `AuthGate`, `HomeTiles`, `TopicTree` (multi-select, grouped by chapter, with mastery coloring), `DifficultyPicker`, `TimerRing` (animated, reads duration_ms), `ProblemCanvas` (KaTeX prompt + choices/entry), `Scoreboard` (live, animated deltas), `RevealPanel` (answer + solution), `ResultsScreen`, `ProfileDashboard` (mastery heatmap, streak calendar, history), `RaceConsole`.
- `PartyLobby` (create/join, presence roster, ready toggles, share link/code), `HostControls`.

Performance:
- Prefetch the next round's problem prompt where the protocol allows, but never the answer.
- Answer buttons must register input immediately with optimistic UI, then reconcile with `answer_ack`.

Accessibility: keyboard answer selection (1-4 keys map to choices), numeric keypad for Race, reduced-motion mode, colorblind-safe scoreboard.

---

## 15. Repo structure

```
/ (empty repo the user provides)
├─ systemdesignftw.md            # this file
├─ README.md
├─ .env.local.example            # every var from Section 20, no values
├─ package.json
├─ next.config.js
├─ tailwind.config.ts
├─ tsconfig.json
├─ app/                          # Next.js App Router
│  ├─ (auth)/...
│  ├─ home/
│  ├─ solo/
│  ├─ party/
│  ├─ race/
│  ├─ session/[id]/
│  ├─ profile/
│  └─ api/                       # thin route handlers if needed
├─ components/                   # UI components from Section 14
├─ lib/
│  ├─ supabaseClient.ts
│  ├─ sessionMachine.ts
│  ├─ scoring.ts                 # Section 7 formulas (shared with edge fns)
│  ├─ timing.ts                  # Section 5 model
│  ├─ normalizeAnswer.ts         # Section 10.3
│  └─ elo.ts
├─ supabase/
│  ├─ migrations/                # SQL from Section 11
│  └─ functions/                 # edge functions from Section 9
│     ├─ start_match/
│     ├─ start_round/
│     ├─ submit_answer/
│     ├─ finalize_round/
│     └─ finalize_match/
├─ content/
│  ├─ taxonomy.json              # Section 6 as data
│  ├─ problems/                  # generated bank, one file per topic+difficulty
│  │  └─ {group_id}/{topic_id}.{difficulty}.json
│  ├─ generators/                # per-chapter generation scripts/prompts
│  ├─ validator.ts               # Section 10.6
│  ├─ seed.ts                    # loads validated bank into Supabase
│  └─ reports/validation.json
└─ tests/
```

Generate `content/taxonomy.json` first from Section 6; every other workstream depends on stable topic IDs.

---

## 16. Repo bootstrap sequence

1. Confirm repo URL and package manager with the user (checkpoint 19.0).
2. Scaffold Next.js + TypeScript + Tailwind, add deps, commit.
3. Write `content/taxonomy.json` and `.env.local.example`.
4. Write `lib/` pure logic (scoring, timing, elo, normalizeAnswer) with unit tests. These have no external deps and unblock both game and validator work.
5. Write the SQL migrations (do not apply until the Supabase checkpoint).
6. Then fan out per Section 17.

---

## 17. Sub-agent dispatch plan

Dispatch these workstreams. Groups A and B are the heavy parallel fan-out.

**Group A — Problem bank generation (parallel, one agent per chapter, 22 agents).**
Each chapter agent:
- Reads its chapter's leaves from `content/taxonomy.json` and the rubric in Section 5.
- Generates, per leaf, per difficulty, the volume target from Section 10.5, in the schema of Section 10.2.
- Applies distractor rules (Section 10.4).
- Writes to `content/problems/{group_id}/{topic_id}.{difficulty}.json`.
- Does not self-certify: each problem must be independently verifiable by the validator. Prefer problems whose answers a symbolic checker can confirm.
- Uses the sample generation prompt in Appendix B as its template.

**Group B — App build (parallel by surface).**
- B1 Auth + profile + settings + guest.
- B2 Solo flow (config, session, results) using `sessionMachine`.
- B3 Party/MP flow (lobby, presence, host controls) + Realtime wiring.
- B4 Edge functions (server authority, scoring, finalize) + migrations.
- B5 Speed Multiplication Race (procedural generator, sprint + first-to-N, solo + MP).
- B6 Profile dashboard (mastery heatmap, streak calendar, achievements, history).
- B7 Design system + shared components (TimerRing, Scoreboard, ProblemCanvas, TopicTree).

**Group C — Validation + seeding (runs after A produces files, iterative).**
- Runs `content/validator.ts` over all generated JSON.
- Emits `content/reports/validation.json`.
- Sends rejects back to the owning chapter agent (Group A) for regeneration.
- Once green, runs `content/seed.ts` (only after Supabase checkpoint).

**Group D — QA / integration.**
- End-to-end: two simulated clients complete a ranked MP session; assert server-authoritative scoring, streak update, Elo change, no answer leakage before reveal.
- Solo and Race e2e.
- Load-check a single room with 8 players.

Dependency order: taxonomy + lib logic -> (A and B in parallel) -> C gating on A -> D gating on B4 + C -> deployment gates.

---

## 18. Milestones

- **M0 Scaffold:** repo, deps, taxonomy, lib logic with tests. No external services.
- **M1 Solo playable locally:** solo session against a small seeded local problem set (agent hand-seeds ~20 problems to unblock, before full bank exists). Timer, scoring, results all work.
- **M2 Bank complete:** Group A + C green, validation report passing, full JSON bank committed.
- **M3 Backend live:** Supabase provisioned (checkpoint), migrations applied, RLS on, bank seeded, edge functions deployed.
- **M4 Multiplayer:** party lobby, realtime rounds, server-authoritative scoring, ranked Elo, streaks.
- **M5 Race + Profile:** Speed Multiplication Race and full profile dashboard.
- **M6 Deploy:** Vercel production deploy (checkpoint), env wired, smoke test.

---

## 19. Deployment gateways and human checkpoints

At each checkpoint below, STOP and prompt the user with the exact text in the "Ask the user" block. Do not create accounts, projects, tokens, or spend anything without an explicit answer. Explain briefly why you need it.

---

> ### HUMAN CHECKPOINT 19.0 — Repo and package manager
> **Why:** need the target and tooling before scaffolding.
> **Ask the user:**
> - Paste the empty GitHub repo URL, or confirm I should scaffold locally and you will add the remote.
> - Package manager: npm, pnpm, or yarn?
> - Confirm the monorepo/single-app layout in Section 15 is acceptable.

---

> ### HUMAN CHECKPOINT 19.1 — Content volume sign-off
> **Why:** the bank size drives generation time and token cost.
> **Ask the user:**
> - Confirm 50 (floor) or 60 (target) problems per topic-leaf per difficulty. This is roughly 12,900 to 15,480 problems.
> - Confirm MC as the primary answer format with free-entry as a solo-only extra.

---

> ### HUMAN CHECKPOINT 19.2 — Supabase provisioning (AUTH REQUIRED)
> **Why:** I cannot create your Supabase project or write to your database without your credentials. Applying migrations and seeding the bank both require the service role key, which must never be committed or placed in client code.
> **What I need you to do:**
> 1. Create a Supabase project (or tell me the existing project ref). Pick a region close to your players and confirm the plan (free tier is fine for development).
> 2. Provide, via the secure method you prefer (env file locally, not chat if you would rather keep them private):
>    - `NEXT_PUBLIC_SUPABASE_URL`
>    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
>    - `SUPABASE_SERVICE_ROLE_KEY` (server/edge only, never client)
>    - `SUPABASE_PROJECT_REF` (for the CLI)
> 3. Confirm whether I should use the Supabase CLI to apply migrations and deploy edge functions. The CLI needs a login/access token: either you run `supabase login` yourself, or you provide `SUPABASE_ACCESS_TOKEN`.
> 4. Decide guest mode: enable Supabase anonymous sign-in (recommended) yes/no.
> **I will not apply migrations or seed data until you confirm this checkpoint.**

---

> ### HUMAN CHECKPOINT 19.3 — Auth providers
> **Why:** OAuth requires provider credentials that only you can generate.
> **Ask the user:**
> - Which providers beyond email/password? Google is recommended.
> - For each chosen provider, you must create the OAuth app in that provider's console and paste the client ID/secret into the Supabase Auth dashboard. Tell me when done, and give me the redirect URLs you want whitelisted (local + production).

---

> ### HUMAN CHECKPOINT 19.4 — Edge function deploy
> **Why:** functions carry the service role and authoritative logic.
> **Ask the user:**
> - Confirm I may deploy the five edge functions to your Supabase project (needs the access token from 19.2).
> - Confirm the round-pacing decision from Section 9: host-driven (default) or fully server-scheduled.

---

> ### HUMAN CHECKPOINT 19.5 — Vercel deploy (AUTH REQUIRED)
> **Why:** deploying the frontend needs access to your Vercel account, and I must set env vars in the Vercel dashboard, not in the repo.
> **What I need you to do:**
> 1. Create/confirm a Vercel project linked to the GitHub repo, or provide `VERCEL_TOKEN` if you want me to deploy via CLI.
> 2. Confirm the production domain (Vercel default subdomain is fine to start).
> 3. I will add these env vars to Vercel (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The service role key goes only to Supabase Edge Functions, never to Vercel client env. Confirm you understand this split.
> **I will not push a production deploy until you confirm.**

---

> ### HUMAN CHECKPOINT 19.6 — Billing awareness
> **Why:** protect you from surprise costs.
> **Ask the user:**
> - Acknowledge that Supabase Realtime, database size, and edge function invocations, plus Vercel bandwidth, can exceed free tiers under real traffic. Confirm you have set any spend limits you want before public launch.

---

## 20. Environment variables reference

Put these in `.env.local` (local) and the appropriate dashboard (never commit real values). `.env.local.example` mirrors this with empty values.

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | edge/server only | privileged writes; NEVER client, NEVER Vercel public |
| `SUPABASE_PROJECT_REF` | tooling | CLI target |
| `SUPABASE_ACCESS_TOKEN` | tooling | CLI auth for migrations/functions (optional if user runs CLI) |
| `VERCEL_TOKEN` | tooling | optional, CLI deploy |
| `NEXT_PUBLIC_SITE_URL` | client | redirect URLs, share links |

---

## 21. Security and anti-cheat

- All competitive scoring, timing, and rating live in edge functions with the service role. Clients cannot write score/rating/streak rows (RLS + no client policy).
- Correct answers are withheld until `round_reveal`.
- Submission timing measured server-side from `server_start_ts`.
- Rate-limit `submit_answer` to one scored write per player per round; ignore duplicates.
- Validate room membership on every edge function call.
- Sanitize all LaTeX at render (KaTeX with `throwOnError: false` in UI, strict in validator).
- Guest accounts cannot enter ranked matches (no rating to stake); allow them in casual and solo.

---

## 22. Testing and QA

- **Unit:** `scoring.ts`, `elo.ts`, `timing.ts`, `normalizeAnswer.ts`. Include edge cases (last-instant correct, timeout, wrong-in-ranked penalty).
- **Validator self-test:** feed known-good and known-bad problems, assert the bad ones are rejected with correct reasons.
- **Integration:** two simulated Supabase clients complete a ranked session; assert Elo sums to zero across players, streaks increment once per day, no answer leakage.
- **Content spot-check:** sample 1% of the bank per topic for human review in a PR before M2 sign-off.
- **E2E:** Playwright covering solo, party create/join, a full MP session, a Race sprint.

---

## 23. Open questions for the user (resolve during build, none block M0/M1)

1. Visual identity: any color/theme/mascot direction, or agent's discretion?
2. Endless solo mode: cap at some round count for stats sanity, or truly unbounded?
3. Leaderboards: global only, or also per-topic-group and per-Race-config?
4. Freeze-token economy: keep the 1-per-7-days rule or adjust?
5. Per-group Elo: build now or leave stubbed for v2?
6. Spectator mode for parties: v1 or later?

---

## Appendix A — Difficulty examples (one topic, three tiers)

Topic `ch10.factoring_1` (Factoring Quadratics I):

- **Easy:** Factor `x^2 + 5x + 6`. (clean, positive, single step) complexity 0.9
- **Medium:** Factor `2x^2 - 7x + 3`. (leading coefficient, sign handling) complexity 1.1
- **Hard:** Find the sum of all integer values of `k` for which `x^2 + kx + 24` factors over the integers. (requires enumerating factor pairs, insight) complexity 1.4

Topic `ch21.telescoping`:

- **Easy:** Evaluate `sum_{n=1}^{3} (1/n - 1/(n+1))`. complexity 1.1
- **Medium:** Evaluate `sum_{n=1}^{10} 1/(n(n+1))`. complexity 1.3
- **Hard:** Evaluate `sum_{n=1}^{20} 1/(n(n+2))` (needs a two-term partial fraction shift). complexity 1.5

## Appendix B — Sub-agent generation prompt template (Group A)

```
You are generating validated math problems for Fo The Win.
TOPIC_ID: {topic_id}   (AoPS section {source_section}, {display_name})
DIFFICULTY: {difficulty}
COUNT: {count}

Constraints:
- Follow the difficulty rubric: Easy = 1 concept / 1-2 steps / clean numbers;
  Medium = 2-3 steps, mild casework or a prerequisite combined in;
  Hard = insight or clever manipulation, may combine two topics from THIS chapter only.
- Do NOT require any topic from a later chapter than this one.
- Output an array of problem objects in the exact schema (Section 10.2).
- answer_format = "mc". Provide 4 choices, one correct, 3 distractors that
  follow the distractor archetypes (Section 10.4): sign error, arithmetic slip,
  wrong-order/wrong-term, incomplete method, topic-specific misconception.
- Fill correct_answer, answer_type, accepted_forms so a free-entry variant works.
- Set complexity_factor per the Section 5 anchors for this topic band.
- Write a concise solution_latex that shows the key step, not a wall of text.
- All LaTeX must compile under KaTeX. Use $...$ inline.
- Every answer must be independently verifiable (prefer problems a symbolic/numeric
  checker can confirm). Do not fabricate answers.

Return ONLY the JSON array. No prose, no markdown fences.
```

---

*End of systemdesignftw.md*
