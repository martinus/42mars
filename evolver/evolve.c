// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// 42evolve: evolves Redcode warriors against a panel of hill warriors, with
// a list kept by diversity push-off (#142, docs/evolver.md).
//
//   42evolve <run folder> --opponents <dir> [options]   a new run
//   42evolve <run folder> [--threads N] [--batches N] [--seconds S]
//            [--changes name=weight,...] [--reintroduce p] [--list N (larger)]
//            [--screen-stop z | --screen-check z]
//                                                       continue a run
//
// The run folder gets events.jsonl (what happened, for the dashboard),
// state.txt (to continue) and best.red. The same seed gives the same run on
// any number of threads. Ctrl-C ends the run after the current batch.
//
// POSIX threads; Linux and macOS.
//
// This file: the command line, the defaults of a new run and what is wrong
// with its parameters (params_error()), the usage, main(). The others:
// run.c a run and its steps, batch.c one batch, pool.c the thread pool,
// events.c the events, state.c state.txt and islands.txt, panel.c the
// opponent folder and the panel, islands.c --islands, optimize.c
// --optimize; evolve.h what they share.

#include "evolve.h"

params default_params(void) {
  params p;
  memset(&p, 0, sizeof p);
  p.rules = m42_rules_94();
  p.panel = 30;   // by kinds (--panel-choice); the defaults of a new run are those of gen-var16-rnd (docs/evolver-gen.md)
  p.holdout = 100;
  p.list = 80;
  p.batch = 0; // 4 per thread
  p.survivors = 0; // batch / 8
  p.rounds = 100;
  p.screen_rounds = 20;
  p.bench_every = 10;
  p.bench_rounds = 100;
  p.init_length = 10;
  p.tie = 1;
  p.screen_factor = 0.8;
  p.alpha = 1;
  p.reintroduce = 0.02;
  p.sd = SD_OPPONENT;
  p.seed = 1;
  p.changes = genome_mix_default();
  p.ladder_every = 10;
  p.yield_half = 100;
  p.ladder_above = 200;
  return p;
}

volatile sig_atomic_t stop_now = 0;
static void on_signal(int sig) {
  stop_now = 1;
  signal(sig, SIG_DFL); // a second Ctrl-C ends it at once
}

// ---------------------------------------------------------------- main

static void usage(void) {
  fprintf(stderr,
          "usage: 42evolve <run folder> --opponents <dir> [--panel 30] [--holdout 100] [--list 80]\n"
          "         [--batch 128] [--survivors N] [--rounds 100] [--screen-rounds 20] [--screen-factor 0.8]\n"
          "         [--bench-every 10] [--bench-rounds 100] [--alpha 1] [--sd opponent|sum]\n"
          "         [--reintroduce 0.02] [--init-length 10] [--seed 1] [--draw-seed S]\n"
          "         [--parents value|duel|yield [--yield-half 100]] [--start <dir>] [--changes name=weight,...]\n"
          "         [--panel-choice picked|random|kinds] [--pick-sample 300] [--panel-files a.red,b.red,...]\n"
          "         [--screen-members N] [--screen-stop z | --screen-check z] [--stage N (screen rounds; 0 none)]\n"
          "         [--fill | --no-fill] [--panel-rounds N] [--diversity all|panel] [--average all|panel]\n"
          "         [--member-games all|none] [--pushoff value|pareto|pareto-sd] [--clear R] [--positions mirror|pmars]\n"
          "         [--genome list|gen] [--min-length N] [--tie-points t] [--parsimony] [--no-spl]\n"
          "         [--survivors-by strength|pushoff] [--replace-parent] [--events brief|full]\n"
          "         [--ladder [--ladder-every 10] [--ladder-above 200]]\n"
          "         [--islands N [--select-after B [--keep K]] [--score-rounds R] [--score-designs 3]\n"
          "           [--migrate M [--migrate-pick best|random] [--migrate-to all|random]] [--island-variant \"options\" ...] [--island-panels shared|own] [--explorers K]\n"
          "           [--groups K [--group-every 10] [--group-slots panel/3] [--group-hall slots/2]]]\n"
          "         [--size 8000] [--cycles 80000] [--processes 8000] [--length 100] [--distance 100]\n"
          "         [--threads N] [--batches N] [--seconds S]\n"
          "       42evolve <run folder> [--threads N] [--batches N] [--seconds S] [--changes ...] [--reintroduce p] [--list N]\n"
          "         [--screen-stop z | --screen-check z]   (continue a run)\n"
          "       42evolve <folder> --optimize <warrior.red> --opponents <dir> [--panel N | --panel-files ...]\n"
          "         [--rounds 100] [--holdout 100] [--bench-rounds 100] [--seed 1] [--threads N]\n"
          "         [--optimize-moves constants,fields,pairs,field-pairs]   (its constants, fields, pairs of them)\n");
  exit(2);
}

static uint32_t hardware_threads(void) {
  const long n = sysconf(_SC_NPROCESSORS_ONLN);
  return n > 0 ? (uint32_t)n : 1;
}

// Does the mix draw a kind of change that only a generator has?
static int structure_kinds(const genome_mix *m) {
  for (int k = CH_COUNT; k < CH_ALL; k++)
    if (m->w[k]) return 1;
  return 0;
}
#define STRUCTURE_NEEDS_GEN "--changes with a kind of generators (repeat to transplant) needs --genome gen"

// What is wrong with the parameters of a new run (defaults applied), 0 nothing.
static const char *params_error(const params *p) {
  static char text[96];
  if (p->rules.max_length < 1 || p->rules.max_length > GENOME_MAX) {
    snprintf(text, sizeof text, "--length 1 to %d", GENOME_MAX);
    return text;
  }
  if (!p->list || !p->rounds || !p->init_length) return "--list, --rounds and --init-length at least 1";
  if (p->screen_rounds > p->rounds) return "--screen-rounds at most --rounds";
  if (p->rules.core_size < 2 * p->rules.min_distance) return "--size at least twice --distance";
  if (p->stage && p->stage < p->screen_rounds) return "--stage at least --screen-rounds, or 0";
  if (p->panel_rounds && p->panel_rounds < p->rounds) return "--panel-rounds at least --rounds";
  if (p->member_games_none && (!p->average_panel || !p->distance_panel || p->parents == PARENTS_DUEL || p->screen_members))
    return "--member-games none only with --average panel and --diversity panel, not with --parents duel or "
           "--screen-members";
  if (p->pareto && p->average_panel && !p->member_games_none)
    return "--pushoff pareto not with --average panel, unless with --member-games none";
  if (p->pareto == 1 && p->member_games_none) return "--member-games none with --pushoff pareto-sd, not pareto";
  if (p->clear > 0 && !p->pareto) return "--clear with --pushoff pareto or pareto-sd only";
  if (p->survivors_by && !p->pareto) return "--survivors-by pushoff with --pushoff pareto or pareto-sd only";
  if (p->screen_stop > 0 && p->screen_check > 0) return "--screen-stop or --screen-check, not both";
  if (!p->gen && structure_kinds(&p->changes)) return STRUCTURE_NEEDS_GEN;
  if (p->min_length > p->rules.max_length) return "--min-length at most --length";
  if (!(p->tie >= 0 && p->tie <= 3)) return "--tie-points 0 to 3";
  if (p->ladder && (p->panel_random != PANEL_KINDS || p->panel_files[0])) return "--ladder with --panel-choice kinds, not with --panel-files";
  if (!p->ladder_every || !(p->ladder_above > 0)) return "--ladder-every 1 or more, --ladder-above more than 0";
  return 0;
}

// What the command line says: the parameters of a new run (before the
// defaults of new_run_defaults()), and what else it asks for.
typedef struct {
  params p;
  const char *dir;
  uint32_t threads, batches;
  double seconds;
  genome_mix new_changes; // --changes, also for a run that continues
  int changes_given;
  double new_stop, new_check; // --screen-stop, --screen-check, also for a run that continues
  double new_reintroduce;     // --reintroduce, also for a run that continues
  uint32_t new_list;          // --list, also for a run that continues (it only grows)
  int new_options, stage_given, screen_members_given, diversity_given, panel_rounds_given, fill_given;
  int panel_choice_given, draw_seed_given, positions_given, pushoff_given, genome_given, migrate_given;
  int events_given; // --events
  int ladder_option; // --ladder-every or --ladder-above given
  int yield_option;  // --yield-half given
  int variant_default; // the variants of new_island_defaults(), not given
  const char *pushoff_fallback; // the option that made the default push-off value, not pareto-sd (#199)
  uint32_t islands_n, islands_keep, islands_every, islands_rounds; // --islands, --keep, --select-after, --score-rounds
  uint32_t islands_designs;                                         // --score-designs
  uint32_t islands_migrate_every;                                   // --migrate
  uint32_t migrate_random, migrate_next, pick_given, to_given;      // --migrate-pick, --migrate-to
  int own_panels;                                                   // --island-panels own
  uint32_t explorers;                                               // --explorers
  uint32_t groups, group_every, group_slots, group_hall;            // --groups, --group-every, --group-slots, --group-hall (#183)
  int group_option;                                                 // one of the last three given
  int islands_option;
  const char *variant[ISLANDS_MAX]; // --island-variant, in their order
  uint32_t variant_n;
  const char *optimize_file; // --optimize: no run, the constants of this warrior
} cli;

// The options removed after 1.1.0 (#193): refused with a message, also in an
// --island-variant (a state that used one: load_state()).
static const char *const removed_options[] = {"--map-elites", "--specialists", "--niche", "--sharing", "--simple",
                                              "--noise", "--difference", "--select", "--rotate", "--race", "--race-keep",
                                              "--tune-novel", "--fractions", "--prior", "--refactor",
                                              "--leaf-restart", "--nemesis-every", 0};

// An option of the command line whose value need not be a number (a word,
// a folder, a file; --tie-points takes what strtod() reads, d), into c: 1
// if a is one of them, else 0. *rc: the exit code after a message.
static int option_text(cli *c, const char *a, const char *v, double d, int *rc) {
  params *p = &c->p;
  if (!strcmp(a, "--opponents")) snprintf(p->opponents, sizeof p->opponents, "%s", v);
  else if (!strcmp(a, "--start")) snprintf(p->start, sizeof p->start, "%s", v);
  else if (!strcmp(a, "--optimize")) c->optimize_file = v;
  else if (!strcmp(a, "--optimize-moves")) { // a comma list of constants, fields, pairs, field-pairs
    static const char *const names[] = {"constants", "fields", "pairs", "field-pairs"};
    p->optimize_moves = 0;
    for (const char *q = v; *q;) {
      const char *end = strchr(q, ',');
      const size_t len = end ? (size_t)(end - q) : strlen(q);
      int k = 0;
      while (k < 4 && !(strlen(names[k]) == len && !strncmp(names[k], q, len))) k++;
      if (k == 4) {
        fprintf(stderr, "42evolve: --optimize-moves takes constants, fields, pairs and field-pairs, comma separated, not '%.*s'\n", (int)len, q);
        *rc = 2;
        return 1;
      }
      p->optimize_moves |= 1u << k;
      q += len + (end ? 1 : 0);
    }
    if (!p->optimize_moves) usage();
  }
  else if (!strcmp(a, "--panel-files")) {
    if (!*v || strlen(v) >= sizeof p->panel_files || strstr(v, ",,") || v[strlen(v) - 1] == ',') usage();
    snprintf(p->panel_files, sizeof p->panel_files, "%s", v);
  }
  else if (!strcmp(a, "--changes")) {
    if (names_loop(v)) {
      fprintf(stderr, "42evolve: --changes loop was removed after 1.1.0 (#193)\n");
      *rc = 2;
      return 1;
    }
    if (genome_mix_parse(&p->changes, v) != 0) {
      fprintf(stderr, "42evolve: --changes takes name=weight,... with these names:");
      for (int k = 0; k < CH_COUNT; k++) fprintf(stderr, " %s", genome_change_name(k));
      fprintf(stderr, "\nand with --genome gen:");
      for (int k = CH_COUNT; k < CH_ALL; k++) fprintf(stderr, " %s", genome_change_name(k));
      fprintf(stderr, "\n");
      *rc = 2;
      return 1;
    }
    c->new_changes = p->changes, c->changes_given = 1;
  }
  else if (!strcmp(a, "--parents")) {
    if (!strcmp(v, "value")) p->parents = PARENTS_VALUE;
    else if (!strcmp(v, "duel")) p->parents = PARENTS_DUEL;
    else if (!strcmp(v, "yield")) p->parents = PARENTS_YIELD;
    else usage();
  } else if (!strcmp(a, "--panel-choice")) {
    c->panel_choice_given = 1;
    if (!strcmp(v, "picked")) p->panel_random = PANEL_PICKED;
    else if (!strcmp(v, "random")) p->panel_random = PANEL_RANDOM;
    else if (!strcmp(v, "kinds")) p->panel_random = PANEL_KINDS;
    else usage();
  } else if (!strcmp(a, "--diversity")) {
    c->diversity_given = 1;
    if (!strcmp(v, "all")) p->distance_panel = 0;
    else if (!strcmp(v, "panel")) p->distance_panel = 1;
    else usage();
  } else if (!strcmp(a, "--member-games")) {
    if (!strcmp(v, "all")) p->member_games_none = 0;
    else if (!strcmp(v, "none")) p->member_games_none = 1;
    else usage();
  } else if (!strcmp(a, "--average")) {
    if (!strcmp(v, "all")) p->average_panel = 0;
    else if (!strcmp(v, "panel")) p->average_panel = 1;
    else usage();
  } else if (!strcmp(a, "--pushoff")) {
    c->pushoff_given = 1;
    if (!strcmp(v, "value")) p->pareto = 0;
    else if (!strcmp(v, "pareto")) p->pareto = 1;
    else if (!strcmp(v, "pareto-age")) {
      fprintf(stderr, "42evolve: --pushoff pareto-age was removed after 1.1.0 (#193)\n");
      *rc = 2;
      return 1;
    }
    else if (!strcmp(v, "pareto-sd")) p->pareto = 3;
    else usage();
  } else if (!strcmp(a, "--events")) {
    if (!strcmp(v, "full")) p->events_brief = 0;
    else if (!strcmp(v, "brief")) p->events_brief = 1;
    else usage();
    c->events_given = 1;
  } else if (!strcmp(a, "--survivors-by")) {
    if (!strcmp(v, "strength")) p->survivors_by = 0;
    else if (!strcmp(v, "pushoff")) p->survivors_by = 1;
    else usage();
  } else if (!strcmp(a, "--migrate-pick")) {
    if (!strcmp(v, "best")) c->migrate_random = 0;
    else if (!strcmp(v, "random")) c->migrate_random = 1;
    else usage();
    c->pick_given = c->islands_option = 1;
  } else if (!strcmp(a, "--migrate-to")) {
    if (!strcmp(v, "all")) c->migrate_next = MIGRATE_ALL;
    else if (!strcmp(v, "random")) c->migrate_next = MIGRATE_RANDOM;
    else if (!strcmp(v, "next") || !strcmp(v, "tree")) {
      fprintf(stderr, "42evolve: --migrate-to %s was removed after 1.1.0 (#193)\n", v);
      *rc = 2;
      return 1;
    }
    else usage();
    c->to_given = c->islands_option = 1;
  } else if (!strcmp(a, "--island-panels")) {
    if (!strcmp(v, "shared")) c->own_panels = 0;
    else if (!strcmp(v, "own")) c->own_panels = 1;
    else usage();
    c->islands_option = 1;
  } else if (!strcmp(a, "--island-variant")) {
    if (c->variant_n >= ISLANDS_MAX) usage();
    c->variant[c->variant_n++] = v;
    c->islands_option = 1;
  } else if (!strcmp(a, "--tie-points")) {
    p->tie = d;
  } else if (!strcmp(a, "--genome")) {
    c->genome_given = 1;
    if (!strcmp(v, "gen")) p->gen = 1;
    else if (!strcmp(v, "list")) p->gen = 0;
    else usage();
  } else if (!strcmp(a, "--positions")) {
    c->positions_given = 1;
    if (!strcmp(v, "mirror")) p->mirror = 1;
    else if (!strcmp(v, "pmars")) p->mirror = 0;
    else usage();
  } else if (!strcmp(a, "--sd")) {
    if (!strcmp(v, "opponent")) p->sd = SD_OPPONENT;
    else if (!strcmp(v, "sum")) p->sd = SD_SUM;
    else usage();
  } else return 0;
  return 1;
}

// An option of the command line whose value is a number (d, and u when it
// is a whole number from 0 to 2^32 - 1, else 0), into c; the usage when a
// is none.
static void option_number(cli *c, const char *a, int number, double d, uint32_t u) {
  params *p = &c->p;
  if (!strcmp(a, "--panel")) p->panel = u;
  else if (!strcmp(a, "--holdout")) p->holdout = u;
  else if (!strcmp(a, "--list")) p->list = c->new_list = u;
  else if (!strcmp(a, "--batch")) p->batch = u;
  else if (!strcmp(a, "--survivors")) p->survivors = u;
  else if (!strcmp(a, "--rounds")) p->rounds = u;
  else if (!strcmp(a, "--screen-rounds")) p->screen_rounds = u;
  else if (!strcmp(a, "--screen-factor")) p->screen_factor = d;
  else if (!strcmp(a, "--bench-every")) p->bench_every = u;
  else if (!strcmp(a, "--bench-rounds")) p->bench_rounds = u;
  else if (!strcmp(a, "--alpha")) p->alpha = d;
  else if (!strcmp(a, "--reintroduce")) {
    if (!number || d < 0 || d > 1) usage();
    p->reintroduce = c->new_reintroduce = d;
  }
  else if (!strcmp(a, "--screen-members")) p->screen_members = u, c->screen_members_given = 1;
  else if (!strcmp(a, "--stage")) p->stage = u, c->stage_given = 1;
  else if (!strcmp(a, "--panel-rounds")) p->panel_rounds = u, c->panel_rounds_given = 1;
  else if (!strcmp(a, "--pick-sample")) p->pick_sample = u;
  else if (!strcmp(a, "--ladder-every")) p->ladder_every = u, c->ladder_option = 1;
  else if (!strcmp(a, "--yield-half")) p->yield_half = u, c->yield_option = 1;
  else if (!strcmp(a, "--ladder-above")) p->ladder_above = d, c->ladder_option = 1;

  else if (!strcmp(a, "--screen-stop") || !strcmp(a, "--screen-check")) {
    const int stop = !strcmp(a, "--screen-stop");
    if (!number || d < 0 || (!stop && !(d > 0))) usage(); // --screen-stop 0: off
    if (stop) p->screen_stop = c->new_stop = d;
    else p->screen_check = c->new_check = d;
  }
  else if (!strcmp(a, "--clear")) {
    if (!number || !(d > 0)) usage();
    p->clear = d;
  }
  else if (!strcmp(a, "--init-length")) p->init_length = u;
  else if (!strcmp(a, "--min-length")) p->min_length = u;
  else if (!strcmp(a, "--seed")) p->seed = (uint64_t)d;
  else if (!strcmp(a, "--draw-seed")) p->draw_seed = (uint64_t)d, c->draw_seed_given = 1;
  else if (!strcmp(a, "--islands")) c->islands_n = u, c->islands_option = 1;
  else if (!strcmp(a, "--keep")) c->islands_keep = u, c->islands_option = 1;
  else if (!strcmp(a, "--select-after")) c->islands_every = u, c->islands_option = 1;
  else if (!strcmp(a, "--score-rounds")) c->islands_rounds = u, c->islands_option = 1;
  else if (!strcmp(a, "--score-designs")) c->islands_designs = u, c->islands_option = 1;
  else if (!strcmp(a, "--migrate")) c->islands_migrate_every = u, c->islands_option = c->migrate_given = 1;
  else if (!strcmp(a, "--explorers")) c->explorers = u, c->islands_option = 1;
  else if (!strcmp(a, "--groups")) c->groups = u, c->islands_option = 1;
  else if (!strncmp(a, "--group-", 8) && u == UINT32_MAX) usage(); // the three below keep the value plus 1
  else if (!strcmp(a, "--group-every")) c->group_every = u + 1, c->islands_option = c->group_option = 1; // these three: 0 not given
  else if (!strcmp(a, "--group-slots")) c->group_slots = u + 1, c->islands_option = c->group_option = 1;
  else if (!strcmp(a, "--group-hall")) c->group_hall = u + 1, c->islands_option = c->group_option = 1;
  else if (!strcmp(a, "--size")) p->rules.core_size = u;
  else if (!strcmp(a, "--cycles")) p->rules.max_cycles = u;
  else if (!strcmp(a, "--processes")) p->rules.max_processes = u;
  else if (!strcmp(a, "--length")) p->rules.max_length = u;
  else if (!strcmp(a, "--distance")) p->rules.min_distance = u;
  else usage();
}

// Reads the command line into c; 0, or the exit code after a message.
static int parse_cli(int argc, char **argv, cli *c) {
  memset(c, 0, sizeof *c);
  c->p = default_params();
  c->new_stop = c->new_check = c->new_reintroduce = -1;
  c->islands_rounds = 100;
  c->islands_designs = 3;
  for (int i = 1; i < argc; i++) {
    const char *a = argv[i];
    if (a[0] != '-') {
      if (c->dir) usage();
      c->dir = a;
      continue;
    }
    for (const char *const *o = removed_options; *o; o++)
      if (!strcmp(a, *o)) {
        fprintf(stderr, "42evolve: %s was removed after 1.1.0 (#193)\n", a);
        return 2;
      }
    if (!strcmp(a, "--fill") || !strcmp(a, "--no-fill")) { // the options without a value
      c->p.fill = !strcmp(a, "--fill");
      c->fill_given = 1;
      c->new_options = 1;
      continue;
    }
    if (!strcmp(a, "--ladder")) {
      c->p.ladder = 1;
      c->new_options = 1;
      continue;
    }
    if (!strcmp(a, "--parsimony") || !strcmp(a, "--no-spl") || !strcmp(a, "--replace-parent")) {
      if (a[2] == 'p') c->p.parsimony = 1;
      else if (a[2] == 'r') c->p.replace_parent = 1;
      else c->p.no_spl = 1;
      c->new_options = 1;
      continue;
    }
    if (i + 1 >= argc) usage();
    const char *v = argv[++i];
    char *end;
    const double d = strtod(v, &end);
    const int number = *end == 0 && end != v;
    const uint32_t u = number && d >= 0 && d <= 4294967295.0 ? (uint32_t)d : 0;
    int run_option = 0, rc = 0;
    if (!strcmp(a, "--threads")) c->threads = u, run_option = 1;
    else if (!strcmp(a, "--batches")) c->batches = u, run_option = 1;
    else if (!strcmp(a, "--seconds")) c->seconds = d, run_option = 1;
    else if (option_text(c, a, v, d, &rc)) {
      if (rc) return rc;
    } else if (!number) usage();
    else option_number(c, a, number, d, u);
    if (!run_option && strcmp(a, "--changes") && strcmp(a, "--screen-stop") && strcmp(a, "--screen-check") &&
        strcmp(a, "--reintroduce") && strcmp(a, "--list"))
      c->new_options = 1; // these go with a run that continues
  }
  return 0;
}

// What a new run says when the default push-off pareto-sd does not go with
// an option given and it takes value instead (#199).
#define PUSHOFF_FALLBACK "%s: the push-off is value, pareto does not go with it"

// The defaults of a new run that depend on what was given, then what is
// wrong with its parameters (params_error()), 0 nothing.
static const char *new_run_defaults(cli *c) {
  params *p = &c->p;
  if (!p->opponents[0]) usage();
  if (p->optimize_moves && !c->optimize_file) return "--optimize-moves with --optimize";
  if (c->ladder_option && !p->ladder) return "--ladder-every and --ladder-above with --ladder";
  if (c->yield_option && p->parents != PARENTS_YIELD) return "--yield-half with --parents yield";
  // new runs: generators (docs/evolver-gen.md), not for --optimize, which keeps lists
  if (!c->genome_given && !c->optimize_file) p->gen = 1;
  if (p->gen && !c->changes_given) p->changes = gen_mix_default(); // the kinds that make structure too
  if (!p->batch) p->batch = 128;
  if (!p->survivors) p->survivors = p->batch / 8 ? p->batch / 8 : 1;
  // --stage by default at the screen rounds (--stage 0: none); a state keeps
  // the value, and states from before --stage have none
  if (!c->stage_given) p->stage = p->screen_rounds;
  // the defaults of the later options, for new runs only (a state before
  // them has none of them): the best run of E5
  if (!c->screen_members_given) p->screen_members = p->member_games_none ? 0 : 10;
  if (!c->diversity_given) p->distance_panel = 1;
  if (!c->panel_rounds_given) p->panel_rounds = p->rounds > 500 ? p->rounds : 500;
  if (!c->panel_choice_given) p->panel_random = PANEL_KINDS; // new runs: a panel of every kind
  if (!c->fill_given) p->fill = 1;
  if (!c->events_given) p->events_brief = 1; // new runs: brief lines for the newcomers that leave in their batch (#187)
  if (!c->positions_given) p->mirror = 1; // new runs: every position from both sides
  // new runs: pareto-sd, first or tied first on the '94 and the tiny hill (docs/evolver.md); value where
  // pareto does not go (params_error() says where)
  if (!c->pushoff_given) {
    p->pareto = 3;
    if (params_error(p)) {
      p->pareto = 0;
      // the caller says so when pareto was what did not go (#199)
      if (!params_error(p)) c->pushoff_fallback = "--average panel";
    }
  }
  // new runs: --screen-stop 3: it stopped 10,639 of 17,025
  // children of kd1 in the screen, 22% of all rounds, and missed none of the 2,400 survivors (docs/evolver.md)
  if (c->new_stop < 0 && !(p->screen_check > 0)) {
    p->screen_stop = 3;
    if (params_error(p)) p->screen_stop = 0;
  }
  if (!c->draw_seed_given) p->draw_seed = p->seed;
  return params_error(p);
}

// --island-variant: what every island must have alike, so that their
// scores and migrants mean the same; 0 when a and b agree, else the option.
static const char *variant_differs(const params *a, const params *b) {
  const m42_rules *x = &a->rules, *y = &b->rules;
  if (x->core_size != y->core_size || x->max_cycles != y->max_cycles || x->max_processes != y->max_processes ||
      x->max_length != y->max_length || x->min_distance != y->min_distance)
    return "--size, --cycles, --processes, --length or --distance";
  if (strcmp(a->opponents, b->opponents) || strcmp(a->start, b->start)) return "--opponents or --start";
  if (a->panel != b->panel || a->holdout != b->holdout || a->panel_random != b->panel_random || a->pick_sample != b->pick_sample ||
      strcmp(a->panel_files, b->panel_files))
    return "--panel, --holdout, --panel-choice, --pick-sample or --panel-files";
  if (a->seed != b->seed || a->draw_seed != b->draw_seed) return "--seed or --draw-seed";
  if (a->gen != b->gen) return "--genome";
  if (a->ladder != b->ladder) return "--ladder";
  return 0;
}

// The parameters of each --island-variant: the command line with the
// variant's options after it, so that they win; 0, or the exit code after
// a message.
static int island_variants(int argc, char **argv, const cli *c, params *out) {
  enum { TOKENS = 64 };
  char **v = xmalloc(((size_t)argc + TOKENS) * sizeof *v);
  static char text[4096];
  int rc = 0;
  for (uint32_t k = 0; k < c->variant_n && !rc; k++) {
    snprintf(text, sizeof text, "%s", c->variant[k]);
    int n = 0;
    for (int i = 0; i < argc; i++) v[n++] = argv[i];
    for (char *save = 0, *t = strtok_r(text, " \t", &save); t; t = strtok_r(0, " \t", &save)) {
      if (n >= argc + TOKENS) {
        fprintf(stderr, "42evolve: --island-variant '%s' has more than %d words\n", c->variant[k], TOKENS);
        rc = 2;
        break;
      }
      v[n++] = t;
    }
    if (rc) break;
    static cli w;
    if ((rc = parse_cli(n, v, &w)) != 0) break;
    w.threads = c->threads;
    const char *wrong = new_run_defaults(&w);
    const char *differs = wrong ? 0 : variant_differs(&c->p, &w.p);
    if (!wrong && (w.batches != c->batches || w.seconds != c->seconds || w.variant_n != (c->variant_default ? 0 : c->variant_n) ||
                   w.islands_n != c->islands_n ||
                   w.islands_keep != c->islands_keep || w.islands_every != c->islands_every ||
                   w.islands_rounds != c->islands_rounds || w.islands_designs != c->islands_designs || w.islands_migrate_every != c->islands_migrate_every ||
                   w.migrate_random != c->migrate_random || w.migrate_next != c->migrate_next || w.own_panels != c->own_panels || w.explorers != c->explorers ||
                   w.groups != c->groups || w.group_every != c->group_every || w.group_slots != c->group_slots || w.group_hall != c->group_hall ||
                   w.optimize_file != c->optimize_file))
      differs = "--batches, --seconds, --optimize or an option of the islands";
    if (wrong || differs) {
      fprintf(stderr, "42evolve: --island-variant '%s': %s%s\n", c->variant[k], wrong ? wrong : differs,
              wrong ? "" : " the same for every island");
      rc = 2;
      break;
    }
    if (w.pushoff_fallback) { // island i has the variant i mod their number
      if (c->variant_default) fprintf(stderr, "42evolve: islands %u", k + 1);
      else fprintf(stderr, "42evolve: --island-variant '%s', islands %u", c->variant[k], k + 1);
      for (uint32_t i = k + c->variant_n; i < c->islands_n; i += c->variant_n) fprintf(stderr, ", %u", i + 1);
      fprintf(stderr, ": " PUSHOFF_FALLBACK "\n", w.pushoff_fallback);
    }
    out[k] = w.p;
  }
  free(v);
  return rc;
}

// A new run of islands (--islands) with the parameters p (defaults applied,
// checked): the checks of the islands' options, their defaults, the
// variants, the run; the exit code.
static int new_islands(int argc, char **argv, cli *c, const params *p, uint32_t threads) {
  const char *dir = c->dir, *optimize_file = c->optimize_file;
  const uint32_t batches = c->batches;
  const double seconds = c->seconds;
  const uint32_t islands_n = c->islands_n, islands_keep = c->islands_keep, islands_every = c->islands_every;
  const uint32_t islands_rounds = c->islands_rounds;
  uint32_t islands_migrate_every = c->islands_migrate_every;
  if (islands_n > ISLANDS_MAX || islands_keep >= islands_n || (islands_keep && !islands_every) || !islands_rounds || optimize_file) {
    fprintf(stderr, "42evolve: --islands 1..%d, --keep fewer than the islands and with --select-after, not with --optimize\n", ISLANDS_MAX);
    return 2;
  }
  if (islands_migrate_every && islands_n < 2) {
    fprintf(stderr, "42evolve: --migrate with 2 islands or more\n");
    return 2;
  }
  if (c->own_panels && (islands_n < 2 || p->panel_files[0] || p->panel_random == PANEL_RANDOM)) {
    fprintf(stderr, "42evolve: --island-panels own with 2 islands or more, a panel that is picked (--panel-choice picked or kinds), not --panel-files\n");
    return 2;
  }
  if (p->ladder && (!c->own_panels || c->groups)) { // each island climbs through candidates of its own; the foe slots of --groups change by themselves
    fprintf(stderr, "42evolve: --ladder with --islands needs --island-panels own, and does not go with --groups\n");
    return 2;
  }
  if (c->explorers && (c->explorers >= islands_n || islands_keep)) {
    fprintf(stderr, "42evolve: --explorers fewer than the islands, not with --keep\n");
    return 2;
  }
  group_options g = {c->groups, c->group_every ? c->group_every - 1 : 10, c->group_slots ? c->group_slots - 1 : p->panel / 3 < 255 ? p->panel / 3 : 255, 0};
  g.hall = c->group_hall ? c->group_hall - 1 : g.slots / 2;
  if (c->group_option && !c->groups) {
    fprintf(stderr, "42evolve: --group-every, --group-slots and --group-hall with --groups\n");
    return 2;
  }
  if (c->groups && (c->groups < 2 || islands_n % c->groups || islands_keep || c->explorers)) {
    fprintf(stderr, "42evolve: --groups K: 2 or more that divide --islands, not with --keep or --explorers\n");
    return 2;
  }
  if (c->groups && (!g.every || !g.slots || g.slots + 2 > p->panel || g.slots > 255 || g.hall > g.slots)) {
    fprintf(stderr, "42evolve: --group-every 1 or more, --group-slots 1 to the panel less 2 (%u) and at most 255, --group-hall at most the slots\n",
            p->panel >= 2 ? p->panel - 2 : 0);
    return 2;
  }
  if ((c->pick_given || c->to_given) && c->migrate_given && !islands_migrate_every) {
    fprintf(stderr, "42evolve: --migrate-pick and --migrate-to not with --migrate 0\n");
    return 2;
  }
  static params variants[ISLANDS_MAX];
  if (!c->variant_n && islands_n >= 2) { // new runs of islands: half exploit, half explore (gen-var16-rnd)
    c->variant[0] = "";
    c->variant[1] = "--screen-members 80 --screen-rounds 8";
    c->variant_n = 2;
    c->variant_default = 1;
  }
  if (c->variant_n > islands_n) {
    fprintf(stderr, "42evolve: --island-variant at most once per island\n");
    return 2;
  }
  {
    const int rc = island_variants(argc, argv, c, variants);
    if (rc) return rc;
  }
  // new runs of islands: every 5 batches a member drawn from an island drawn (gen-var16-rnd); --migrate 0: none
  if (!c->migrate_given && islands_n >= 2) islands_migrate_every = 5;
  if (c->explorers && !islands_migrate_every) {
    fprintf(stderr, "42evolve: --explorers needs migration (not with --migrate 0)\n");
    return 2;
  }
  if (!c->pick_given) c->migrate_random = 1;
  if (!c->to_given) c->migrate_next = MIGRATE_RANDOM;
  signal(SIGINT, on_signal);
  signal(SIGTERM, on_signal);
  return islands_new(p, variants, c->variant, c->variant_n, dir, islands_n, islands_keep, islands_every, islands_rounds,
                     c->islands_designs, islands_migrate_every, c->migrate_random, c->migrate_next, c->explorers,
                     c->own_panels, &g, threads, batches, seconds);
}

// A run that continues: what the command line changes from now on, each
// with its event; 0, or the exit code after a message.
static int resume_changes(run *r, const cli *c) {
  const genome_mix new_changes = c->new_changes;
  const int changes_given = c->changes_given;
  const double new_stop = c->new_stop, new_check = c->new_check, new_reintroduce = c->new_reintroduce;
  const uint32_t new_list = c->new_list;
  if (changes_given) { // the weights of the changes from now on; the run is no longer the one without a break
    r->p.changes = new_changes;
    char mix[CH_ALL * 32];
    genome_mix_text(&r->p.changes, mix, sizeof mix);
    fprintf(r->events, "{\"type\":\"changes\",\"batch\":%u,\"changes\":\"%s\"}\n", r->batch, mix);
  }
  if (new_list) // the list grew (load_state()); children fill the new places
    fprintf(r->events, "{\"type\":\"list\",\"batch\":%u,\"list\":%u,\"fill\":false}\n", r->batch, r->p.list);
  if (new_reintroduce >= 0) { // how often a warrior of the archive comes back, from now on
    r->p.reintroduce = new_reintroduce;
    fprintf(r->events, "{\"type\":\"reintroduce\",\"batch\":%u,\"reintroduce\":%.17g}\n", r->batch, r->p.reintroduce);
  }
  if (new_stop >= 0 || new_check > 0) { // the screen from now on; --screen-stop 0 turns it off
    if (new_stop >= 0) r->p.screen_stop = new_stop, r->p.screen_check = 0;
    if (new_check > 0) r->p.screen_check = new_check, r->p.screen_stop = 0;
    const char *wrong = params_error(&r->p);
    if (wrong) {
      fprintf(stderr, "42evolve: %s\n", wrong);
      return 2;
    }
    fprintf(r->events, "{\"type\":\"screen-options\",\"batch\":%u,\"screenStop\":%.17g,\"screenCheck\":%.17g}\n", r->batch,
            r->p.screen_stop, r->p.screen_check);
  }
  return 0;
}

int main(int argc, char **argv) {
  static run r;
  static cli c;
  {
    const int rc = parse_cli(argc, argv, &c);
    if (rc) return rc;
  }
  r.p = c.p;
  const char *dir = c.dir, *optimize_file = c.optimize_file;
  uint32_t threads = c.threads;
  const uint32_t batches = c.batches;
  const double seconds = c.seconds;
  const genome_mix new_changes = c.new_changes;
  const int changes_given = c.changes_given, new_options = c.new_options;
  const double new_stop = c.new_stop, new_check = c.new_check, new_reintroduce = c.new_reintroduce;
  const uint32_t new_list = c.new_list;
  const uint32_t islands_n = c.islands_n;
  const int islands_option = c.islands_option;
  if (!dir) usage();
  if (!threads) threads = hardware_threads();
  snprintf(r.dir, sizeof r.dir, "%s", dir);

  char state[1100];
  snprintf(state, sizeof state, "%s/state.txt", dir);
  {
    char isl[1100];
    snprintf(isl, sizeof isl, "%s/islands.txt", dir);
    if (access(isl, F_OK) == 0) { // a run of islands that continues
      if (new_options || islands_option || changes_given || new_stop >= 0 || new_check > 0 || new_reintroduce >= 0 || new_list) {
        fprintf(stderr, "42evolve: %s has islands; only --threads, --batches and --seconds go with it\n", dir);
        return 2;
      }
      signal(SIGINT, on_signal);
      signal(SIGTERM, on_signal);
      return islands_resume(dir, threads, batches, seconds);
    }
  }
  if (islands_option && !islands_n) usage();
  const int resume = !optimize_file && access(state, F_OK) == 0;
  if (resume) {
    if (new_options) {
      fprintf(stderr,
              "42evolve: %s has a run; only --threads, --batches, --seconds, --changes, --reintroduce, --list (larger), "
              "--screen-stop and --screen-check go with it\n",
              dir);
      return 2;
    }
    r.list_grow = new_list;
    if (run_resume(&r) != 0) return 1;
    if (!r.p.gen && changes_given && structure_kinds(&new_changes)) {
      fprintf(stderr, "42evolve: " STRUCTURE_NEEDS_GEN "\n");
      return 2;
    }
  } else {
    if (!threads) threads = hardware_threads(); // the default --batch
    c.threads = threads;
    const char *wrong = new_run_defaults(&c);
    if (wrong) {
      fprintf(stderr, "42evolve: %s\n", wrong);
      return 2;
    }
    // islands with variants say it per variant (island_variants())
    if (c.pushoff_fallback && !c.variant_n && islands_n < 2) fprintf(stderr, "42evolve: " PUSHOFF_FALLBACK "\n", c.pushoff_fallback);
    r.p = c.p;
    if (islands_n) return new_islands(argc, argv, &c, &r.p, threads);
    if (run_new(&r, threads, optimize_file != 0) != 0) return 1;
  }

  if (run_open(&r, resume, threads) != 0) return 1;
  signal(SIGINT, on_signal);
  signal(SIGTERM, on_signal);

  if (optimize_file) {
    const int rc = optimize(&r, optimize_file);
    pool_stop(r.pool);
    fclose(r.events);
    return rc;
  }
  if (!resume) {
    run_first(&r);
  } else {
    fprintf(r.events, "{\"type\":\"resume\",\"batch\":%u}\n", r.batch);
    const int rc = resume_changes(&r, &c);
    if (rc) return rc;
  }
  fprintf(stderr, "42evolve: %s, %u panel and %u holdout warriors, %u threads, batch %u\n", dir, r.panel_n, r.hold_n,
          threads, r.batch);

  const double t0 = now();
  for (uint32_t done = 0; !stop_now && (!batches || done < batches) && (!seconds || now() - t0 < seconds); done++) {
    run_step(&r);
  }
  pool_stop(r.pool);
  fclose(r.events);
  return 0;
}
