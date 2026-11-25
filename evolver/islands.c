// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The islands of 42evolve (--islands): several runs in one process, in
// rounds of batches, with the scores against the whole folder, the
// selection of islands, migration and the islands' own panels.

#include "evolve.h"

// ---------------------------------------------------------------- islands

// --islands N: N runs in one process, in <dir>/island-01 ... (each an
// ordinary run folder: it can be continued, served and read alone). The
// panel is picked once, and every island gets it as --panel-files and the
// same --draw-seed, so all of them have the same panel and holdout; island i
// evolves with the seed + i - 1. One pool of threads, and the islands play
// in rounds (islands_loop()): every island its next batch, all at the same
// time, so they advance by batches, not by time, and the run is the same on
// any thread count. Every --select-after batches of each, the best.red of each island
// and its three members best against the panel play every warrior of the
// opponent folder (--score-rounds rounds each, 100); the first time, the --keep
// islands with the best of those scores go on and the others stop (their
// folders stay). The root has islands.txt (its state) and islands.jsonl (its
// events: start, pick, score), and best.red: the best warrior scored so far.
static void island_name(const islands *I, uint32_t i, run *r) {
  snprintf(r->dir, sizeof r->dir, "%s/island-%02u", I->dir, i + 1);
  snprintf(r->label, sizeof r->label, "island-%02u ", i + 1);
}

// Every warrior of the opponent folder, for the scores.
static void islands_opponents(islands *I) {
  uint32_t count;
  char **names = opponent_files(&I->root, &count);
  load_list(&I->root, &I->opp, &I->opp_n, names, count, HOLDOUT, 0);
  for (uint32_t i = 0; i < count; i++) free(names[i]);
  free(names);
}

// Island i of I (its run in I->is[i], with its parameters) starts: its seed
// (the islands' + i), folder, the pool, the panel's matches, from batch.
static int island_start(islands *I, uint32_t i, uint32_t batch) {
  run *r = I->is[i];
  r->p.seed = I->seed + i;
  island_name(I, i, r);
  r->pool = I->root.pool;
  if (run_new(r, r->pool->threads, 0) != 0 || run_open(r, 0, r->pool->threads) != 0) return 1;
  r->batch = batch;
  run_first(r);
  I->live[i] = 1;
  return 0;
}

// names[from .. to) into out, comma separated; 1 if they do not fit.
static int join_files(char *out, size_t size, char *const *names, uint32_t from, uint32_t to) {
  size_t len = 0;
  out[0] = 0;
  for (uint32_t i = from; i < to; i++) {
    const size_t l = strlen(names[i]);
    if (len + l + 2 > size) return 1;
    len += (size_t)snprintf(out + len, size - len, "%s%s", i > from ? "," : "", names[i]);
  }
  return 0;
}

// The best.red of each live island and its three members best against the
// panel, against every warrior of the folder: event `score`; the first time
// with --keep, the islands that go on. The root's best.red: the best so far.
static void islands_score(islands *I) {
  if (!I->opp) islands_opponents(I);
  enum { PER = 4 };
  static const char *const tags[PER] = {"best", "p0", "p1", "p2"};
  const uint32_t n = I->n, m = I->opp_n;
  m42_warrior **w = xmalloc((size_t)n * PER * sizeof *w);
  const genome **g = xmalloc((size_t)n * PER * sizeof *g);
  uint64_t *id = xmalloc((size_t)n * PER * sizeof *id);
  uint32_t *as = xmalloc((size_t)n * PER * sizeof *as); // the place whose matches give this one's score: itself, or best.red's
  for (uint32_t i = 0; i < n; i++) {
    run *r = I->is[i];
    if (!I->live[i]) continue;
    const uint32_t b = i * PER;
    if (r->best_g_set) w[b] = make_warrior(&r->best_g, &r->p.rules), g[b] = &r->best_g, id[b] = r->best_id;
    uint32_t top[3] = {UINT32_MAX, UINT32_MAX, UINT32_MAX}; // the members best against the panel, the first on a tie
    for (uint32_t k = r->panel_n; k < r->active_n; k++) {
      const uint32_t s = r->active[k];
      for (int t = 0; t < 3; t++) {
        if (top[t] != UINT32_MAX && panel_avg(r, s) <= panel_avg(r, top[t])) continue;
        for (int u = 2; u > t; u--) top[u] = top[u - 1];
        top[t] = s;
        break;
      }
    }
    for (int t = 0; t < PER; t++) {
      const uint32_t k = b + t;
      if (t && top[t - 1] != UINT32_MAX) {
        const warrior *x = r->slot[top[t - 1]];
        w[k] = x->w, g[k] = x->g, id[k] = x->id;
      }
      as[k] = t && w[k] && w[b] && id[k] == id[b] ? b : k; // a member that is best.red plays once
    }
  }
  unit *u = xmalloc((size_t)n * PER * m * sizeof *u);
  uint32_t nu = 0;
  for (uint32_t k = 0; k < n * PER; k++)
    for (uint32_t o = 0; o < m && w[k] && as[k] == k; o++)
      u[nu++] = (unit){w[k], I->opp[o].w, seed_for(&I->root, 0x73636f7265000000u + o), 0, I->rounds, {{0}}, 0, 0}; // "score"
  pool_run(I->root.pool, u, nu);
  double *sc = xmalloc((size_t)n * PER * sizeof *sc), *isl = xmalloc(n * sizeof *isl);
  nu = 0;
  for (uint32_t k = 0; k < n * PER; k++) {
    sc[k] = -1;
    if (!w[k] || as[k] != k) continue;
    double s = 0;
    for (uint32_t o = 0; o < m; o++, nu++) s += points(u[nu].s[0], I->rounds);
    sc[k] = s / m;
  }
  uint32_t batch = 0, best_k = UINT32_MAX;
  for (uint32_t i = 0; i < n; i++) {
    isl[i] = -1;
    if (!I->live[i]) continue;
    batch = I->is[i]->batch;
    for (uint32_t k = i * PER; k < (i + 1) * PER; k++) {
      if (!w[k]) continue;
      sc[k] = sc[as[k]];
      if (sc[k] > isl[i]) isl[i] = sc[k];
      if (best_k == UINT32_MAX || sc[k] > sc[best_k]) best_k = k;
    }
  }
  // --keep: the best islands by their best score, the first on a tie
  uint8_t *kept = 0;
  if (!I->selected && I->keep) {
    kept = xmalloc(n);
    for (uint32_t c = 0; c < I->keep; c++) {
      uint32_t b = UINT32_MAX;
      for (uint32_t i = 0; i < n; i++)
        if (I->live[i] && !kept[i] && (b == UINT32_MAX || isl[i] > isl[b])) b = i;
      if (b != UINT32_MAX) kept[b] = 1;
    }
  }
  FILE *f = I->root.events;
  fprintf(f, "{\"type\":\"score\",\"batch\":%u,\"rounds\":%u,\"opponents\":%u,\"islands\":[", batch, I->rounds, m);
  for (uint32_t i = 0, first = 1; i < n; i++) {
    if (!I->live[i]) continue;
    fprintf(f, "%s{\"island\":%u,\"score\":%.4f,\"warriors\":[", first ? "" : ",", i + 1, isl[i]);
    for (int t = 0, ft = 1; t < PER; t++) {
      if (!w[i * PER + t]) continue;
      fprintf(f, "%s{\"tag\":\"%s\",\"id\":%" PRIu64 ",\"score\":%.4f}", ft ? "" : ",", tags[t], id[i * PER + t], sc[i * PER + t]);
      ft = 0;
    }
    fputs("]}", f);
    first = 0;
  }
  fputs("],\"files\":[", f); // the opponents in their order, and the seed of each one's matches
  for (uint32_t o = 0; o < m; o++) {
    if (o) fputc(',', f);
    json_str(f, I->opp[o].file, 0);
  }
  fputs("],\"seeds\":[", f);
  for (uint32_t o = 0; o < m; o++) fprintf(f, "%s%" PRId64, o ? "," : "", seed_for(&I->root, 0x73636f7265000000u + o));
  fputs("]", f);
  if (kept) {
    fputs(",\"kept\":[", f);
    for (uint32_t i = 0, first = 1; i < n; i++)
      if (kept[i]) fprintf(f, "%s%u", first ? "" : ",", i + 1), first = 0;
    fputs("]", f);
  }
  fputs("}\n", f);
  fflush(f);
  if (best_k != UINT32_MAX && sc[best_k] > I->best) { // the root's best.red
    I->best = sc[best_k];
    const run *r = I->is[best_k / PER];
    char path[1100], text[GENOME_MAX * 48 + 64];
    snprintf(path, sizeof path, "%s/best.red", I->dir);
    FILE *b = fopen(path, "w");
    if (b) {
      genome_text(g[best_k], r->p.rules.core_size, text, sizeof text);
      fprintf(b, "%s\n;name island-%02u %s %" PRIu64 "\n;author 42evolve\n;strategy evolved, island %u (seed %" PRIu64 "), batch %u\n"
                 ";strategy %.1f against the %u warriors of %s, %u rounds each\n%s",
              r->p.rules.core_size == 8000 ? ";redcode-94nop" : ";redcode", best_k / PER + 1, tags[best_k % PER], id[best_k],
              best_k / PER + 1, r->p.seed, batch, sc[best_k], m, r->p.opponents, I->rounds, text);
      fclose(b);
    }
  }
  if (kept) {
    for (uint32_t i = 0; i < n; i++)
      if (I->live[i] && !kept[i]) {
        I->live[i] = 0;
        fprintf(stderr, "island-%02u stops (best %.1f against the folder)\n", i + 1, isl[i]);
      }
    I->selected = 1;
    free(kept);
  }
  for (uint32_t i = 0; i < n; i++) free(w[i * PER]); // those of best.red were made here, the others are members
  free(w), free(g), free(id), free(as), free(u), free(sc), free(isl);
}

// --migrate: before island k's batch, the member best against the panel of
// every other live island (the first on a tie) becomes a candidate of it,
// which plays first and enters whatever its screen once it is above the
// threshold, as a start warrior; one that is already in is not played again.
// --migrate-pick random: a member drawn from the seed, the batch and the two
// islands instead of the best; --migrate-to random: from one other live
// island drawn from the seed and the batch. The other islands are
// as the round before left them (islands_loop() takes all migrants of a round
// before its batches), so a run is the same on any thread count and after a
// resume. Event `migrate`: [island, id].

static void islands_migrate(islands *I, uint32_t k) {
  run *r = I->is[k];
  if (!r->migr) {
    r->migr = xmalloc(I->n * sizeof *r->migr);
    r->migr_id = xmalloc(I->n * sizeof *r->migr_id);
    r->migr_noun = xmalloc(I->n * sizeof *r->migr_noun);
  }
  r->migr_n = 0;
  fprintf(r->events, "{\"type\":\"migrate\",\"batch\":%u,\"from\":[", r->batch);
  uint32_t before = k; // --migrate-to random: the island it takes from
  if (I->migrate_next == MIGRATE_RANDOM) { // one of the other live islands
    uint32_t others = 0;
    for (uint32_t j = 0; j < I->n; j++) others += j != k && I->live[j];
    rng g = rng_seed(I->seed, 0x6d69677274u + r->batch, k); // "migrt"
    uint32_t pick = others ? rng_below(&g, others) : 0;
    before = k;
    for (uint32_t j = 0; j < I->n && before == k; j++)
      if (j != k && I->live[j] && pick-- == 0) before = j;
  }
  for (uint32_t j = 0; j < I->n; j++) {
    const run *o = I->is[j];
    if (j == k || !I->live[j]) continue;
    if (I->migrate_next != MIGRATE_ALL && j != before) continue;
    uint32_t best = UINT32_MAX;
    if (I->migrate_random && o->active_n > o->panel_n) {
      rng g = rng_seed(I->seed, 0x6d69677261u + r->batch, (uint64_t)k * ISLANDS_MAX + j); // "migra"
      best = o->active[o->panel_n + rng_below(&g, o->active_n - o->panel_n)];
    }
    for (uint32_t a = o->panel_n; a < o->active_n && !I->migrate_random; a++)
      if (best == UINT32_MAX || panel_avg(o, o->active[a]) > panel_avg(o, best)) best = o->active[a];
    if (best == UINT32_MAX || r->migr_n >= r->p.batch) continue;
    const warrior *w = o->slot[best];
    r->migr[r->migr_n] = *w->g;
    r->migr_id[r->migr_n] = w->id;
    r->migr_noun[r->migr_n] = w->noun;
    fprintf(r->events, "%s[%u,%" PRIu64 "]", r->migr_n ? "," : "", j + 1, w->id);
    r->migr_n++;
  }
  fputs("]}\n", r->events);
}

// Batches in rounds until the limits: in a round every live island plays
// its next batch, all at the same time, each on a thread of its own with its
// matches in the one pool (the serial parts of a batch, the push-off,
// entering, the style of newcomers, the events, overlap). Before a round,
// on one thread: every `every` batches the scores; every `migrate` batches
// the migrants, each island's taken from the others as they are after the
// round before. So a run is the same on any thread count and after a resume. A run stopped
// while its islands took turns (before rounds) may have islands a batch
// ahead: the others catch up first.
// --explorers K: the last K islands never take migrants. Each is an
// independent try, like a run of its own, that no strong design from
// elsewhere pushes out; the other islands (the core) take from all, so what
// an explorer finds is taken up and tuned there (with --island-variant, for
// example --average panel on the core).
// Whether island k takes migrants before its batch b: every --migrate
// batches, not an explorer.
static int island_takes_migrants(const islands *I, uint32_t k, uint32_t b) {
  return I->migrate && b && b % I->migrate == 0 && k < I->n - I->explorers;
}

static void *island_thread(void *arg) {
  run_step(arg);
  return 0;
}

// The batch of each island of round[0 .. m), at the same time.
static void islands_round(islands *I, const uint32_t *round, uint32_t m) {
  if (m == 1) {
    run_step(I->is[round[0]]);
    return;
  }
  pthread_t t[ISLANDS_MAX];
  pthread_attr_t a; // the stack of the main thread, where a batch ran before: macOS gives other threads 512 KB
  pthread_attr_init(&a);
  pthread_attr_setstacksize(&a, (size_t)8 << 20);
  for (uint32_t j = 0; j < m; j++)
    if (pthread_create(&t[j], &a, island_thread, I->is[round[j]]) != 0) {
      fprintf(stderr, "42evolve: cannot start a thread\n");
      exit(1);
    }
  pthread_attr_destroy(&a);
  for (uint32_t j = 0; j < m; j++) pthread_join(t[j], 0);
}

static void islands_loop(islands *I, uint32_t batches, double seconds) {
  const double t0 = now();
  uint32_t lo = UINT32_MAX;
  for (uint32_t i = 0; i < I->n; i++)
    if (I->live[i] && I->is[i]->batch < lo) lo = I->is[i]->batch;
  const uint32_t target = batches ? lo + batches : UINT32_MAX;
  while (!stop_now && (!seconds || now() - t0 < seconds)) {
    lo = UINT32_MAX;
    for (uint32_t i = 0; i < I->n; i++)
      if (I->live[i] && I->is[i]->batch < lo) lo = I->is[i]->batch;
    if (lo == UINT32_MAX || lo >= target) break;
    if (I->every && lo >= I->next_score) { // every live island is there
      islands_score(I);
      I->next_score += I->every;
      islands_save(I);
      continue;
    }
    uint32_t round[ISLANDS_MAX], m = 0; // the islands of this round: those at batch lo
    for (uint32_t i = 0; i < I->n; i++)
      if (I->live[i] && I->is[i]->batch == lo) round[m++] = i;
    for (uint32_t j = 0; j < m; j++) // the migrants first: from the islands as the round before left them
      if (island_takes_migrants(I, round[j], lo)) islands_migrate(I, round[j]);
    islands_round(I, round, m);
  }
}

static void islands_close(islands *I) {
  for (uint32_t i = 0; i < I->n; i++)
    if (I->is[i] && I->is[i]->events) fclose(I->is[i]->events);
  pool_stop(I->root.pool);
  fclose(I->root.events);
}

// --island-panels own: one round robin of the sample, then each island its
// own panel from a random half of the candidates (drawn with the draw seed
// and the island), chosen as pick_panel() chooses; its event `pick` says
// which. The holdout is the same for all: the first warriors of the shuffled
// folder in no island's panel, so that the islands' holdout scores compare.
static int island_panels(islands *I, run *root, const params *base) {
  uint32_t count;
  char **names = opponent_files(root, &count);
  pick_table t;
  pick_play(root, names, count, &t);
  uint8_t *in_panel = calloc(count, 1), *allowed = xmalloc(t.n);
  uint32_t *cand = xmalloc(t.nc * sizeof *cand), *picked = xmalloc((t.want ? t.want : 1) * sizeof *picked);
  char **chosen = xmalloc((t.want ? t.want : 1) * sizeof *chosen);
  const uint32_t half = t.nc / 2;
  int rc = 0;
  if (half < t.want) { // else every island would choose from (almost) the same candidates: one panel for all
    fprintf(stderr, "42evolve: --island-panels own: %u candidates of a sample of %u for a panel of %u; it needs twice the panel: "
                    "a larger --pick-sample or a smaller --panel\n", t.nc, t.n, t.want);
    rc = 1;
  }
  for (uint32_t i = 0; i < I->n && !rc; i++) {
    run *r = I->is[i];
    memcpy(cand, t.order, t.nc * sizeof *cand);
    rng g = rng_seed(base->draw_seed, 0x69736c70616e656cu, i); // "islpanel"
    for (uint32_t j = t.nc; j > 1; j--) {
      const uint32_t k = rng_below(&g, j), x = cand[j - 1];
      cand[j - 1] = cand[k], cand[k] = x;
    }
    memset(allowed, 0, t.n);
    for (uint32_t j = 0; j < half; j++) allowed[cand[j]] = 1;
    const uint32_t np = pick_choose(r, &t, names, allowed, picked);
    if (np < t.want) fprintf(stderr, "42evolve: island %u: a panel of %u warriors, not %u (too few candidates of the kinds)\n", i + 1, np, t.want);
    for (uint32_t j = 0; j < np; j++) chosen[j] = names[picked[j]], in_panel[picked[j]] = 1;
    if (join_files(r->p.panel_files, sizeof r->p.panel_files, chosen, 0, np) != 0) {
      fprintf(stderr, "42evolve: the names of the %u panel warriors of island %u are too long\n", np, i + 1);
      rc = 1;
    }
  }
  if (!rc) { // the holdout: in the shuffled order, the first in no panel (fewer than --holdout when no more are left)
    char **hold = xmalloc((base->holdout ? base->holdout : 1) * sizeof *hold);
    uint32_t h = 0;
    for (uint32_t i = 0; i < count && h < base->holdout; i++)
      if (!in_panel[i]) hold[h++] = names[i];
    char *files = I->is[0]->p.holdout_files;
    if (join_files(files, sizeof I->is[0]->p.holdout_files, hold, 0, h) != 0) {
      fprintf(stderr, "42evolve: the names of the %u holdout warriors are too long\n", h);
      rc = 1;
    }
    for (uint32_t i = 1; i < I->n && !rc; i++) snprintf(I->is[i]->p.holdout_files, sizeof I->is[i]->p.holdout_files, "%s", files);
    free(hold);
  }
  for (uint32_t i = 0; i < count; i++) free(names[i]);
  free(names), free(in_panel), free(allowed), free(cand), free(picked), free(chosen);
  pick_free(&t);
  return rc;
}

// A new run of islands: base has the parameters (defaults applied, checked).
int islands_new(const params *base, const params *variant, const char *const *variant_text, uint32_t variant_n,
                       const char *dir, uint32_t n, uint32_t keep, uint32_t every, uint32_t rounds, uint32_t migrate,
                       uint32_t migrate_random, uint32_t migrate_next, uint32_t explorers,
                       int own_panels, uint32_t threads, uint32_t batches, double seconds) {
  static islands I;
  snprintf(I.dir, sizeof I.dir, "%s", dir);
  I.n = n, I.keep = keep, I.every = every, I.next_score = every, I.seed = base->seed, I.best = -1, I.rounds = rounds;
  I.migrate = migrate, I.migrate_random = migrate_random, I.migrate_next = migrate_next, I.explorers = explorers;
  if (mkdir(dir, 0777) != 0 && errno != EEXIST) {
    fprintf(stderr, "42evolve: cannot make %s\n", dir);
    return 1;
  }
  run *root = &I.root;
  root->p = *base;
  root->p.rules.rounds = root->p.rounds;
  root->p.rules.warriors = 2;
  run_pool(root, threads);
  char path[1100];
  snprintf(path, sizeof path, "%s/islands.jsonl", dir);
  root->events = fopen(path, "wb");
  if (!root->events) {
    fprintf(stderr, "42evolve: cannot write %s\n", path);
    return 1;
  }
  params p = *base;
  if (!own_panels && !p.panel_files[0] && p.panel_random != PANEL_RANDOM) { // the panel, picked once for all
    uint32_t count;
    char **names = opponent_files(root, &count);
    pick_panel(root, names, count);
    const uint32_t pn = count < p.panel ? count : p.panel;
    if (join_files(p.panel_files, sizeof p.panel_files, names, 0, pn) != 0) {
      fprintf(stderr, "42evolve: the names of the %u panel warriors are too long for --panel-files\n", pn);
      return 1;
    }
    for (uint32_t i = 0; i < count; i++) free(names[i]);
    free(names);
  }
  fprintf(root->events, "{\"type\":\"islands\",\"islands\":%u,\"keep\":%u,\"selectAfter\":%u,\"migrate\":%u,\"migratePick\":\"%s\","
                        "\"migrateTo\":\"%s\",\"seed\":%" PRIu64 ",\"drawSeed\":%" PRIu64 ",\"threads\":%u,\"opponents\":",
          n, keep, every, migrate, migrate_random ? "random" : "best",
          migrate_next == MIGRATE_RANDOM ? "random" : "all", base->seed, base->draw_seed,
          threads);
  json_str(root->events, base->opponents, 0);
  fputs(",\"panel\":", root->events);
  json_str(root->events, p.panel_files, 0);
  fprintf(root->events, ",\"islandPanels\":\"%s\",\"explorers\":%u", own_panels ? "own" : "shared", explorers);
  fputs(",\"variants\":[", root->events);
  for (uint32_t k = 0; k < variant_n; k++) {
    if (k) fputc(',', root->events);
    json_str(root->events, variant_text[k], 0);
  }
  fputs("]}\n", root->events);
  event_pick(root);
  fflush(root->events);
  for (uint32_t i = 0; i < n; i++) {
    run *r = I.is[i] = xmalloc(sizeof *r);
    r->p = p;
    if (variant_n) { // --island-variant: island i the variant i mod their number, with the panel picked here
      r->p = variant[i % variant_n];
      snprintf(r->p.panel_files, sizeof r->p.panel_files, "%s", p.panel_files);
    }
  }
  if (own_panels && island_panels(&I, root, base) != 0) return 1;
  for (uint32_t i = 0; i < n; i++)
    if (island_start(&I, i, 0) != 0) return 1;
  islands_save(&I);
  fprintf(stderr, "42evolve: %s, %u islands, %u panel and %u holdout warriors, %u threads\n", dir, n, I.is[0]->panel_n,
          I.is[0]->hold_n, threads);
  islands_loop(&I, batches, seconds);
  islands_close(&I);
  return 0;
}

// A run of islands that continues: each live island from its state.
int islands_resume(const char *dir, uint32_t threads, uint32_t batches, double seconds) {
  static islands I;
  snprintf(I.dir, sizeof I.dir, "%s", dir);
  if (islands_load(&I) != 0) return 1;
  run *root = &I.root;
  for (uint32_t i = 0; i < I.n; i++) {
    if (!I.live[i]) continue;
    run *r = I.is[i] = xmalloc(sizeof *r);
    r->p = default_params(); // what the state does not have (as main() for a run)
    island_name(&I, i, r);
    if (run_resume(r) != 0) return 1;
    if (!root->pool) { // the root: the parameters of the first live island with the seed of the islands
      root->p = r->p;
      root->p.seed = I.seed;
      run_pool(root, threads);
    }
    r->pool = root->pool;
    if (run_open(r, 1, threads) != 0) return 1;
    fprintf(r->events, "{\"type\":\"resume\",\"batch\":%u}\n", r->batch);
  }
  char path[1100];
  snprintf(path, sizeof path, "%s/islands.jsonl", dir);
  root->events = fopen(path, "ab");
  if (!root->events) {
    fprintf(stderr, "42evolve: cannot write %s\n", path);
    return 1;
  }
  fputs("{\"type\":\"resume\"}\n", root->events);
  islands_loop(&I, batches, seconds);
  islands_close(&I);
  return 0;
}
