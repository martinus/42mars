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
  if (run_new(r, r->pool->threads, 0) != 0) return 1;
  if (I->groups && r->panel_n < I->group_slots + 2) { // --groups: before its events and state
    fprintf(stderr, "42evolve: --group-slots %u: island %u has a panel of %u, it needs the slots and 2 more\n", I->group_slots, i + 1,
            r->panel_n);
    return 2;
  }
  if (run_open(r, 0, r->pool->threads) != 0) return 1;
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

// One warrior of a score: the best.red of an island, one of its three
// members best against the panel, or the best member of a design.
enum { SC_BEST, SC_P0, SC_P1, SC_P2, SC_DESIGN, SC_FIXED = SC_DESIGN };
static const char *const score_tags[] = {"best", "p0", "p1", "p2", "design"};

typedef struct {
  m42_warrior *w;     // 0: nobody here (no best.red yet, fewer than 3 members)
  const genome *g;
  const warrior *mem; // the member; 0 for a best.red that is in the list no longer
  uint64_t id;
  uint32_t island, tag;
  uint32_t as;        // the place whose matches give this one's score: itself, or the first of its island with the same warrior
  uint32_t members;   // a design: how many members it has
  uint32_t unit;      // its first match in the units, when it plays
  double score;
} scored;

// The designs of island r with --score-designs members or more, the best
// member of each (by its average against the panel, the first on a tie) into
// out, the best first; how many. A design is a family (the noun of the name)
// and a kind of style: the Kernels and the papers of one island are two.
static uint32_t island_designs(const run *r, uint32_t least, scored *out) {
  uint32_t n = 0;
  for (uint32_t k = r->panel_n; least && k < r->active_n; k++) {
    const uint32_t s = r->active[k];
    const warrior *x = r->slot[s];
    uint32_t d = 0;
    while (d < n && (out[d].mem->noun != x->noun || out[d].mem->style_kind != x->style_kind)) d++;
    if (d == n) out[n++] = (scored){.mem = x, .as = s}; // as: the slot of its best member, until it is placed
    else if (panel_avg(r, s) > panel_avg(r, out[d].as)) out[d].mem = x, out[d].as = s;
    out[d].members++;
  }
  uint32_t kept = 0;
  for (uint32_t d = 0; d < n; d++) { // those with enough members, sorted by the average of their best (insertion: the first stays first)
    if (out[d].members < least) continue;
    const scored x = out[d];
    uint32_t at = kept++;
    for (; at > 0 && panel_avg(r, out[at - 1].as) < panel_avg(r, x.as); at--) out[at] = out[at - 1];
    out[at] = x;
  }
  for (uint32_t d = 0; d < kept; d++) out[d].w = out[d].mem->w, out[d].g = out[d].mem->g, out[d].id = out[d].mem->id, out[d].tag = SC_DESIGN;
  return kept;
}

// The best.red of each live island and its three members best against the
// panel, against every warrior of the folder: event `score`; the first time
// with --keep, the islands that go on. Also the best member of each design
// (--score-designs, island_designs()), which does not count for the island's
// score: that stays the best of the four, so that scores compare with those
// of runs without designs. Every warrior plays once, and the event has its
// points and wins per opponent. The root's best.red: the best scored so far,
// a design's too.
static void islands_score(islands *I) {
  if (!I->opp) islands_opponents(I);
  const uint32_t n = I->n, m = I->opp_n;
  uint32_t places = 0, *first = xmalloc((n + 1) * sizeof *first);
  for (uint32_t i = 0; i < n; i++) // island_designs() gathers every design before it leaves out the small ones: one a member
    places += I->live[i] ? SC_FIXED + (I->designs ? members(I->is[i]) : 0) : 0;
  scored *sc = xmalloc(places * sizeof *sc);
  places = 0;
  for (uint32_t i = 0; i < n; i++) {
    run *r = I->is[i];
    first[i] = places;
    if (!I->live[i]) continue;
    scored *s = sc + places;
    memset(s, 0, SC_FIXED * sizeof *s);
    if (r->best_g_set) {
      const uint32_t slot = slot_of_id(r, r->best_id);
      s[SC_BEST].w = make_warrior(&r->best_g, &r->p.rules), s[SC_BEST].g = &r->best_g, s[SC_BEST].id = r->best_id;
      s[SC_BEST].mem = slot == UINT32_MAX ? 0 : r->slot[slot];
    }
    uint32_t top[3] = {UINT32_MAX, UINT32_MAX, UINT32_MAX}; // the members best against the panel, the first on a tie
    for (uint32_t k = r->panel_n; k < r->active_n; k++) {
      const uint32_t x = r->active[k];
      for (int t = 0; t < 3; t++) {
        if (top[t] != UINT32_MAX && panel_avg(r, x) <= panel_avg(r, top[t])) continue;
        for (int u = 2; u > t; u--) top[u] = top[u - 1];
        top[t] = x;
        break;
      }
    }
    for (int t = 0; t < 3; t++) {
      if (top[t] == UINT32_MAX) continue;
      const warrior *x = r->slot[top[t]];
      s[SC_P0 + t].w = x->w, s[SC_P0 + t].g = x->g, s[SC_P0 + t].id = x->id, s[SC_P0 + t].mem = x;
    }
    const uint32_t count = SC_FIXED + island_designs(r, I->designs, s + SC_FIXED);
    for (uint32_t t = 0; t < count; t++) {
      const uint32_t k = places + t;
      s[t].island = i, s[t].as = k;
      if (t < SC_FIXED) s[t].tag = t;
      for (uint32_t e = 0; e < t && s[t].w && s[t].as == k; e++) // a warrior that is here already plays once
        if (s[e].w && s[e].id == s[t].id) s[t].as = places + e;
    }
    places += count;
  }
  first[n] = places;
  unit *u = xmalloc((size_t)places * m * sizeof *u);
  uint32_t nu = 0;
  for (uint32_t k = 0; k < places; k++) {
    if (!sc[k].w || sc[k].as != k) continue;
    sc[k].unit = nu;
    for (uint32_t o = 0; o < m; o++)
      u[nu++] = (unit){sc[k].w, I->opp[o].w, seed_for(&I->root, 0x73636f7265000000u + o), 0, I->rounds, {{0}}, 0, 0}; // "score"
  }
  pool_run(I->root.pool, u, nu);
  for (uint32_t k = 0; k < places; k++) {
    sc[k].score = -1;
    if (!sc[k].w) continue;
    const unit *mine = u + sc[sc[k].as].unit; // an earlier place's, whose score is the same sum
    double s = 0;
    for (uint32_t o = 0; o < m; o++) s += points(mine[o].s[0], I->rounds);
    sc[k].score = s / m;
  }
  double *isl = xmalloc(n * sizeof *isl);
  uint32_t batch = 0, best_k = UINT32_MAX;
  for (uint32_t i = 0; i < n; i++) {
    isl[i] = -1;
    if (!I->live[i]) continue;
    batch = I->is[i]->batch;
    for (uint32_t k = first[i]; k < first[i + 1]; k++) {
      if (!sc[k].w) continue;
      if (sc[k].tag != SC_DESIGN && sc[k].score > isl[i]) isl[i] = sc[k].score;
      if (best_k == UINT32_MAX || sc[k].score > sc[best_k].score) best_k = k;
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
  char text[GENOME_MAX * 48 + 64];
  fprintf(f, "{\"type\":\"score\",\"batch\":%u,\"rounds\":%u,\"opponents\":%u,\"islands\":[", batch, I->rounds, m);
  for (uint32_t i = 0, sep = 0; i < n; i++) {
    if (!I->live[i]) continue;
    fprintf(f, "%s{\"island\":%u,\"score\":%.4f,\"warriors\":[", sep++ ? "," : "", i + 1, isl[i]);
    for (uint32_t k = first[i], ft = 1; k < first[i + 1]; k++) {
      const scored *s = &sc[k];
      if (!s->w) continue;
      fprintf(f, "%s{\"tag\":\"%s\",\"id\":%" PRIu64 ",\"score\":%.4f", ft ? "" : ",", score_tags[s->tag], s->id, s->score);
      ft = 0;
      if (s->tag == SC_DESIGN)
        fprintf(f, ",\"noun\":\"%s\",\"kind\":\"%s\",\"members\":%u", name_noun(s->mem->noun), style_kind_name(s->mem->style_kind), s->members);
      if (s->as == k) { // what it is and its matches, once: a later place with this id has them here
        if (s->mem) {
          fputs(",\"name\":", f);
          json_str(f, s->mem->name, 0);
        }
        fputs(",\"code\":", f);
        genome_text(s->g, I->is[i]->p.rules.core_size, text, sizeof text);
        json_str(f, text, 0);
        // per opponent, in the order of files: 3 for a win and 1 for a tie in the match's rounds, and the wins
        // (ties: points - 3 wins)
        const unit *mine = u + s->unit;
        fputs(",\"points\":[", f);
        for (uint32_t o = 0; o < m; o++) fprintf(f, "%s%u", o ? "," : "", 3 * mine[o].s[0].wins + mine[o].s[0].ties);
        fputs("],\"wins\":[", f);
        for (uint32_t o = 0; o < m; o++) fprintf(f, "%s%u", o ? "," : "", mine[o].s[0].wins);
        fputs("]", f);
      }
      fputs("}", f);
    }
    fputs("]}", f);
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
    for (uint32_t i = 0, sep = 0; i < n; i++)
      if (kept[i]) fprintf(f, "%s%u", sep++ ? "," : "", i + 1);
    fputs("]", f);
  }
  fputs("}\n", f);
  fflush(f);
  if (best_k != UINT32_MAX && sc[best_k].score > I->best) { // the root's best.red
    const scored *s = &sc[best_k];
    I->best = s->score;
    const run *r = I->is[s->island];
    char path[1100];
    snprintf(path, sizeof path, "%s/best.red", I->dir);
    FILE *b = fopen(path, "w");
    if (b) {
      genome_text(s->g, r->p.rules.core_size, text, sizeof text);
      fprintf(b, "%s\n;name island-%02u %s %" PRIu64 "\n;author 42evolve\n;strategy evolved, island %u (seed %" PRIu64 "), batch %u\n"
                 ";strategy %.1f against the %u warriors of %s, %u rounds each\n%s",
              r->p.rules.core_size == 8000 ? ";redcode-94nop" : ";redcode", s->island + 1, score_tags[s->tag], s->id,
              s->island + 1, r->p.seed, batch, s->score, m, r->p.opponents, I->rounds, text);
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
  for (uint32_t k = 0; k < places; k++)
    if (sc[k].tag == SC_BEST) free(sc[k].w); // those of best.red were made here, the others are members
  free(first), free(sc), free(u), free(isl);
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

// --groups K (#183): island k is in group k K / n, the islands of a group
// one after the other.
static uint32_t group_of(const islands *I, uint32_t k) { return I->groups ? k * I->groups / I->n : 0; }

// --no-spl (#185): an island with it takes migrants only from islands with
// it, so that no SPL comes in; the others take from every island. With
// --groups only from its own group.
static int takes_from(const islands *I, uint32_t k, uint32_t j) {
  return (!I->is[k]->p.no_spl || I->is[j]->p.no_spl) && group_of(I, k) == group_of(I, j);
}

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
  if (I->migrate_next == MIGRATE_RANDOM) { // one of the other live islands it takes from
    uint32_t others = 0;
    for (uint32_t j = 0; j < I->n; j++) others += j != k && I->live[j] && takes_from(I, k, j);
    rng g = rng_seed(I->seed, 0x6d69677274u + r->batch, k); // "migrt"
    uint32_t pick = others ? rng_below(&g, others) : 0;
    before = k;
    for (uint32_t j = 0; j < I->n && before == k; j++)
      if (j != k && I->live[j] && takes_from(I, k, j) && pick-- == 0) before = j;
  }
  for (uint32_t j = 0; j < I->n; j++) {
    const run *o = I->is[j];
    if (j == k || !I->live[j] || !takes_from(I, k, j)) continue;
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

// --groups K: the islands are K groups, and migrants stay in their group.
// Every --group-every batches the last --group-slots S panel slots of every
// island get foes, warriors of the other groups (event `rotate` of each one
// that changes, replace_panel()). S - H of them are the best members (by
// average against the panel of their island) of the other groups in turn:
// the best of the next group, the best of the group after it, ..., then the
// second best of each, and so on. H (--group-hall) are drawn from the
// island's hall of fame, the foes that left its slots (the latest HALL_MAX),
// none that is chosen already; while the hall has fewer, those slots take
// more of the best. A foe chosen again keeps its slot and is not played
// again. Every choice is made before any slot changes, from the islands as
// the round before left them, so a run is the same on any thread count and
// after a resume. Until the first foes the slots hold hill warriors. Each
// island's state is saved after its foes and islands.txt after all of them:
// a run killed hard in between (SIGINT and SIGTERM end only after a batch)
// does the foes again on its resume, from halls that already have the foes
// that left, as a score in that place is played again.
typedef struct {
  genome g;
  char name[64];
  uint32_t island; // from 1, 0: none chosen
  uint64_t id;
} foe_pick;

typedef struct {
  const warrior *w;
  uint32_t island; // from 0
  double avg;
} foe_cand;

static int is_foe(const warrior *w, const foe_pick *f) { return f->island && w->foe_island == f->island && w->foe_id == f->id; }

// The hall of fame of r gets the foe w (a copy), the oldest leaves when it is full.
static void hall_add(run *r, const warrior *w) {
  for (uint32_t h = 0; h < r->hall_n; h++)
    if (r->hall[h].foe_island == w->foe_island && r->hall[h].foe_id == w->foe_id) return;
  if (!r->hall) r->hall = xmalloc(HALL_MAX * sizeof *r->hall);
  if (r->hall_n == HALL_MAX) {
    free(r->hall[0].g);
    memmove(r->hall, r->hall + 1, (HALL_MAX - 1) * sizeof *r->hall);
    r->hall_n--;
  }
  warrior *h = &r->hall[r->hall_n++];
  memset(h, 0, sizeof *h);
  h->g = xmalloc(sizeof *h->g);
  *h->g = *w->g;
  snprintf(h->name, sizeof h->name, "%s", w->name);
  h->foe_island = w->foe_island, h->foe_id = w->foe_id;
}

static void take_member(foe_pick *f, const foe_cand *x) {
  f->g = *x->w->g;
  snprintf(f->name, sizeof f->name, "%s", x->w->name);
  f->island = x->island + 1, f->id = x->w->id;
}

static void take_hall(foe_pick *f, const warrior *h) {
  f->g = *h->g;
  snprintf(f->name, sizeof f->name, "%s", h->name);
  f->island = h->foe_island, f->id = h->foe_id;
}

static void islands_foes(islands *I) {
  const uint32_t K = I->groups, S = I->group_slots, n = I->n;
  foe_cand *best = xmalloc((size_t)K * S * sizeof *best);
  uint32_t *bn = xmalloc(K * sizeof *bn);
  memset(bn, 0, K * sizeof *bn);
  for (uint32_t j = 0; j < n; j++) { // the S best members of each group, the best first (on a tie the earlier island, then slot)
    if (!I->live[j]) continue;
    const run *o = I->is[j];
    foe_cand *b = best + (size_t)group_of(I, j) * S;
    uint32_t *c = &bn[group_of(I, j)];
    for (uint32_t a = o->panel_n; a < o->active_n; a++) {
      const foe_cand x = {o->slot[o->active[a]], j, panel_avg(o, o->active[a])};
      uint32_t at = *c < S ? (*c)++ : S;
      if (at == S && !(x.avg > b[S - 1].avg)) continue;
      if (at == S) at = S - 1;
      for (; at > 0 && b[at - 1].avg < x.avg; at--) b[at] = b[at - 1];
      b[at] = x;
    }
  }
  foe_pick *pick = xmalloc((size_t)n * S * sizeof *pick);
  memset(pick, 0, (size_t)n * S * sizeof *pick);
  for (uint32_t k = 0; k < n; k++) {
    if (!I->live[k]) continue;
    const run *r = I->is[k];
    foe_pick *f = pick + (size_t)k * S;
    const uint32_t g = group_of(I, k), want_hall = I->group_hall < S ? I->group_hall : S;
    const foe_cand *in_turn[256]; // the best of the other groups in turn, at most S
    uint32_t nb = 0;
    for (uint32_t rank = 0; rank < S && nb < S; rank++)
      for (uint32_t t = 1; t < K && nb < S; t++) {
        const uint32_t h = (g + t) % K;
        if (rank < bn[h]) in_turn[nb++] = &best[(size_t)h * S + rank];
      }
    uint32_t taken = 0, from_hall = 0;
    for (uint32_t b = 0; b < nb && b < S - want_hall; b++) take_member(&f[taken++], in_turn[b]);
    uint32_t order[HALL_MAX]; // the hall, shuffled
    for (uint32_t h = 0; h < r->hall_n; h++) order[h] = h;
    rng d = rng_seed(I->seed, 0x666f6573u + r->batch, k); // "foes"
    for (uint32_t h = r->hall_n; h > 1; h--) {
      const uint32_t q = rng_below(&d, h), x = order[h - 1];
      order[h - 1] = order[q], order[q] = x;
    }
    for (uint32_t h = 0; h < r->hall_n && from_hall < want_hall && taken < S; h++) {
      const warrior *x = &r->hall[order[h]];
      int dup = 0;
      for (uint32_t q = 0; q < taken; q++) dup |= is_foe(x, &f[q]);
      if (dup) continue;
      take_hall(&f[taken++], x);
      from_hall++;
    }
    for (uint32_t b = S - want_hall; b < nb && taken < S; b++) { // the hall had fewer: more of the best
      int dup = 0;
      for (uint32_t q = 0; q < taken; q++) dup |= f[q].island == in_turn[b]->island + 1 && f[q].id == in_turn[b]->w->id;
      if (!dup) take_member(&f[taken++], in_turn[b]);
    }
  }
  free(best), free(bn);
  for (uint32_t k = 0; k < n; k++) {
    if (!I->live[k]) continue;
    run *r = I->is[k];
    foe_pick *f = pick + (size_t)k * S;
    const uint32_t first = r->panel_n - S;
    uint8_t placed[256] = {0}, kept[256] = {0}; // a chosen foe that is in a slot already stays there
    for (uint32_t t = 0; t < S; t++)
      for (uint32_t q = 0; q < S; q++)
        if (!kept[q] && !placed[t] && is_foe(&r->panel[first + q], &f[t])) kept[q] = placed[t] = 1;
    uint32_t q = 0, changed = 0;
    for (uint32_t t = 0; t < S; t++) {
      if (placed[t] || !f[t].island) continue;
      while (q < S && kept[q]) q++;
      if (q == S) break;
      warrior *old = &r->panel[first + q];
      if (old->foe_island) hall_add(r, old);
      warrior nw;
      foe_warrior(r, &nw, &f[t].g, r->next_id++, f[t].island, f[t].id, f[t].name);
      replace_panel(r, first + q, &nw);
      kept[q] = 1;
      changed++;
    }
    if (changed) event_values(r); // the values the next batch starts from
    save_state(r);
  }
  free(pick);
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
  if (I->groups && I->groups == I->n) return 0; // --groups: one island in each group, nobody to take from
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
    if (I->groups && lo >= I->next_foes) { // --groups: the foes, every live island is there
      islands_foes(I);
      I->next_foes += I->group_every;
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
                       const char *dir, uint32_t n, uint32_t keep, uint32_t every, uint32_t rounds, uint32_t designs,
                       uint32_t migrate, uint32_t migrate_random, uint32_t migrate_next, uint32_t explorers,
                       int own_panels, const group_options *groups, uint32_t threads, uint32_t batches, double seconds) {
  static islands I;
  snprintf(I.dir, sizeof I.dir, "%s", dir);
  I.n = n, I.keep = keep, I.every = every, I.next_score = every, I.seed = base->seed, I.best = -1, I.rounds = rounds, I.designs = designs;
  I.migrate = migrate, I.migrate_random = migrate_random, I.migrate_next = migrate_next, I.explorers = explorers;
  I.groups = groups->k, I.group_every = groups->every, I.group_slots = groups->slots, I.group_hall = groups->hall;
  I.next_foes = groups->every;
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
  fprintf(root->events, ",\"islandPanels\":\"%s\",\"explorers\":%u,\"scoreDesigns\":%u", own_panels ? "own" : "shared", explorers,
          designs);
  if (I.groups) fprintf(root->events, ",\"groups\":%u,\"groupEvery\":%u,\"groupSlots\":%u,\"groupHall\":%u", I.groups, I.group_every, I.group_slots, I.group_hall);
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
    char own[1100]; // --start with a folder island-NN in it: island NN starts from that folder
    struct stat st;
    snprintf(own, sizeof own, "%s/island-%02u", base->start, i + 1);
    if (base->start[0] && strlen(own) < sizeof r->p.start && stat(own, &st) == 0 && S_ISDIR(st.st_mode))
      snprintf(r->p.start, sizeof r->p.start, "%s", own);
  }
  if (own_panels && island_panels(&I, root, base) != 0) return 1;
  for (uint32_t i = 0; i < n; i++) {
    const int rc = island_start(&I, i, 0);
    if (rc) return rc;
  }
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
