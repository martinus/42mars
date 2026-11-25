// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The state of 42evolve, what a run continues from: state.txt of a run (its
// parameters, the params line, the panel, the members, the matrix) and
// islands.txt of a run of islands.

#include "evolve.h"

// ---------------------------------------------------------------- state

// The params line of a state: the fields in their order. An option removed
// after 1.1.0 (#193) keeps its place, written as 0, so that states from
// before and after read alike; a state with another value there used the
// option, and load_state() refuses it.
typedef struct {
  char type;        // 'u' uint32_t, 'd' int, 'g' double, 'q' uint64_t; '-' a removed option's place
  size_t at;        // offsetof(params, ...)
  const char *gone; // '-': the option, 0 for a place whose value says nothing (that of --race-keep)
} param_field;
#define PF(t, f) {t, offsetof(params, f), 0}
#define GONE(o) {'-', 0, o}
static const param_field param_fields[] = {
    PF('u', panel), PF('u', holdout), PF('u', list), PF('u', batch), PF('u', survivors), PF('u', rounds),
    PF('u', screen_rounds), PF('u', bench_every), PF('u', bench_rounds), PF('u', init_length), PF('g', screen_factor),
    PF('g', alpha), PF('g', reintroduce), PF('d', sd), PF('q', seed), GONE("--select"), GONE("--rotate"),
    GONE("--fractions"), GONE("--race"), GONE(0), GONE("--prior"), PF('d', parents), PF('u', screen_members),
    GONE("--noise"), PF('u', stage), PF('d', fill), PF('u', panel_rounds), PF('d', distance_panel), GONE("--niche"),
    GONE("--map-elites"), GONE("--specialists"), GONE("--sharing"), PF('g', screen_stop), PF('g', screen_check),
    GONE("--tune-novel"), PF('d', average_panel), PF('d', member_games_none), GONE("--simple"), PF('q', draw_seed),
    GONE("--difference"), PF('d', pareto), PF('d', mirror), PF('g', clear), PF('d', gen), GONE("--refactor"),
    PF('u', min_length), PF('g', tie)};
#define PARAM_FIELDS (sizeof param_fields / sizeof *param_fields)

static void save_params(FILE *f, const params *p) {
  fputs("params", f);
  for (size_t i = 0; i < PARAM_FIELDS; i++) {
    const param_field *x = &param_fields[i];
    const char *q = (const char *)p + x->at;
    switch (x->type) {
      case 'u': fprintf(f, " %u", *(const uint32_t *)q); break;
      case 'd': fprintf(f, " %d", *(const int *)q); break;
      case 'g': fprintf(f, " %.17g", *(const double *)q); break;
      case 'q': fprintf(f, " %" PRIu64, *(const uint64_t *)q); break;
      default: fputs(" 0", f);
    }
  }
  fputc('\n', f);
}

// The fields of a params line into p, as many as it has: an older state has
// fewer, and the others keep their defaults. Returns how many; *gone: the
// first removed option the state used, else 0.
static int load_params(const char *text, params *p, const char **gone) {
  *gone = 0;
  int got = 0;
  for (size_t i = 0; i < PARAM_FIELDS; i++, got++) {
    const param_field *x = &param_fields[i];
    char *q = (char *)p + x->at, *e;
    if (x->type == 'u') {
      const unsigned long v = strtoul(text, &e, 10);
      if (e != text) *(uint32_t *)q = (uint32_t)v;
    } else if (x->type == 'd') {
      const long v = strtol(text, &e, 10);
      if (e != text) *(int *)q = (int)v;
    } else if (x->type == 'q') {
      const unsigned long long v = strtoull(text, &e, 10);
      if (e != text) *(uint64_t *)q = (uint64_t)v;
    } else {
      const double v = strtod(text, &e);
      if (e != text && x->type == 'g') *(double *)q = v;
      if (e != text && x->type == '-' && v != 0 && x->gone && !*gone) *gone = x->gone;
    }
    if (e == text) break;
    text = e;
  }
  return got;
}

void save_state(run *r) {
  char path[1100], tmp[1100];
  snprintf(path, sizeof path, "%s/state.txt", r->dir);
  snprintf(tmp, sizeof tmp, "%s/state.tmp", r->dir);
  fflush(r->events);
  const long events_size = ftell(r->events);
  FILE *f = fopen(tmp, "w");
  if (!f) {
    fprintf(stderr, "42evolve: cannot write %s\n", tmp);
    exit(1);
  }
  const params *p = &r->p;
  fprintf(f, "42evolve-state 1\n");
  fprintf(f, "rules %u %u %u %u %u\n", p->rules.core_size, p->rules.max_cycles, p->rules.max_processes,
          p->rules.max_length, p->rules.min_distance);
  save_params(f, p);
  fprintf(f, "opponents %s\n", p->opponents);
  if (p->start[0]) fprintf(f, "start-dir %s\n", p->start);
  char mix[CH_ALL * 32];
  genome_mix_text(&p->changes, mix, sizeof mix);
  fprintf(f, "changes %s\n", mix);
  for (uint32_t i = 0; i < r->panel_n; i++) fprintf(f, "panel-id %" PRIu64 " %s\n", r->panel[i].id, r->panel[i].file);
  for (uint32_t i = 0; i < r->hold_n; i++) fprintf(f, "holdout %s\n", r->hold[i].file);
  fprintf(f, "batch %u\nnext %" PRIu64 "\nbest %" PRIu64 " %.17g\nevents %ld\n", r->batch, r->next_id, r->best_id,
          r->best_holdout, events_size);
  char text[GENOME_SAVE_MAX];
  // the members' slots: a later newcomer takes the lowest free one, so a
  // resumed run needs the holes where they were
  for (uint32_t i = 0; i < r->active_n; i++)
    if (r->slot[r->active[i]]->kind == MEMBER) fprintf(f, "slot %" PRIu64 " %u\n", r->slot[r->active[i]]->id, r->active[i]);
  for (uint32_t i = 0; i < r->active_n; i++) {
    const warrior *w = r->slot[r->active[i]];
    if (w->kind != MEMBER) continue;
    genome_save(w->g, text, sizeof text);
    fprintf(f, "member %" PRIu64 " %u %" PRIu64 " %" PRIu64 " %.17g %u %u %u %s\nops %s\nkind %d\norigin %u\n", w->id, w->born,
            w->parents[0], w->parents[1], w->holdout, w->adjective, w->noun, w->earlier, text, w->ops, w->style_kind, w->origin);
  }
  for (uint32_t i = 0; i < r->archive_n; i++) {
    genome_save(&r->archive[i], text, sizeof text);
    fprintf(f, "archive %" PRIu64 " %u %s\n", r->archive_id[i], r->archive_noun[i], text);
  }
  fprintf(f, "archive-next %u\n", r->archive_next);
  if (r->best_g_set) { // the warrior of best.red
    genome_save(&r->best_g, text, sizeof text);
    fprintf(f, "best-genome %s\n", text);
  }
  for (uint32_t i = 0; i < NAME_ADJECTIVES * NAME_NOUNS; i++)
    if (r->names[i]) fprintf(f, "names %u %u\n", i, r->names[i]);
  for (uint32_t i = 0; i < r->active_n; i++)
    for (uint32_t j = 0; j < i; j++) {
      const uint32_t a = r->active[i], b = r->active[j];
      const m42_score s = r->wlt[a * r->cap + b];
      fprintf(f, "score %" PRIu64 " %" PRIu64 " %u %u %u\n", r->slot[a]->id, r->slot[b]->id, s.wins, s.losses, s.ties);
      if (stage_rounds(p) < p->rounds) {
        const m42_score s1 = r->wlt1[a * r->cap + b];
        fprintf(f, "score1 %" PRIu64 " %" PRIu64 " %u %u %u\n", r->slot[a]->id, r->slot[b]->id, s1.wins, s1.losses,
                s1.ties);
      }
    }
  fprintf(f, "seen-next %u\n", r->seen_next);
  for (uint32_t i = 0; i < r->seen_n; i++) fprintf(f, "seen %016" PRIx64 "\n", r->seen[i]);
  fprintf(f, "end\n");
  if (fclose(f) != 0 || rename(tmp, path) != 0) {
    fprintf(stderr, "42evolve: cannot write %s\n", path);
    exit(1);
  }
}

// Does a --changes text name the change loop (#182), removed after 1.1.0
// (#193)? A state names only the kinds it draws.
int names_loop(const char *mix) {
  for (const char *q = mix; (q = strstr(q, "loop=")) != 0; q++)
    if (q == mix || q[-1] == ',') return 1;
  return 0;
}

// The lines of a state before its matrix is made: the panel's and the
// holdout's files (the panel's ids), and the lines that need the matrix.
typedef struct {
  char **panel, **hold, **rest;
  uint64_t *panel_id;
  uint32_t pn, hn, rn;
} state_lines;

// A line of a state before the matrix is made: the rules, the parameters,
// the folders, the changes, the panel and the holdout; the others go into
// s->rest. 0, or -1 when the state is bad (*refused: with its own message).
static int state_head_line(run *r, char *line, state_lines *s, int *refused) {
  params *p = &r->p;
  if (!strncmp(line, "rules ", 6)) {
    if (sscanf(line + 6, "%u %u %u %u %u", &p->rules.core_size, &p->rules.max_cycles, &p->rules.max_processes,
               &p->rules.max_length, &p->rules.min_distance) != 5)
      return -1;
  } else if (!strncmp(line, "params ", 7)) {
    const char *gone;
    const int got = load_params(line + 7, p, &gone);
    if (got < 15) return -1; // the first version had 15; what a state lacks keeps its default
    if (!gone && p->pareto == 2) gone = "--pushoff pareto-age"; // 3 is pareto-sd
    if (gone) {
      fprintf(stderr, "42evolve: %s: %s was removed after 1.1.0 (#193)\n", r->dir, gone);
      *refused = 1;
      return -1;
    }
    if (got < 39) p->draw_seed = p->seed; // a state from before --draw-seed: the folder in the order of the seed
  } else if (!strncmp(line, "opponents ", 10)) {
    snprintf(p->opponents, sizeof p->opponents, "%s", line + 10);
  } else if (!strncmp(line, "start-dir ", 10)) {
    snprintf(p->start, sizeof p->start, "%s", line + 10);
  } else if (!strncmp(line, "changes ", 8)) { // a state without it has the rates of genome_mix_default()
    if (names_loop(line + 8)) {
      fprintf(stderr, "42evolve: %s: --changes loop was removed after 1.1.0 (#193)\n", r->dir);
      *refused = 1;
      return -1;
    }
    if (genome_mix_parse(&p->changes, line + 8) != 0) return -1;
  } else if (!strncmp(line, "panel ", 6)) { // a state from before panel-id: the ids are 0, 1, ...
    s->panel_id[s->pn] = s->pn;
    s->panel[s->pn++] = line + 6;
  } else if (!strncmp(line, "panel-id ", 9)) {
    int used = 0;
    if (sscanf(line + 9, "%" SCNu64 " %n", &s->panel_id[s->pn], &used) != 1 || !used) return -1;
    s->panel[s->pn++] = line + 9 + used;
  } else if (!strncmp(line, "reserve ", 8)) { // the rest of the folder, for --rotate and --prior hill (#193)
  } else if (!strncmp(line, "holdout ", 8)) {
    s->hold[s->hn++] = line + 8;
  } else {
    s->rest[s->rn++] = line;
  }
  return 0;
}

// A line of a state that needs the matrix: the members and their slots
// (slot_id[k] in slot_at[k], *slots of them so far), the archive, the
// names, the scores, the seen hashes. *last: the member of the last member
// line, which the lines after it belong to. 0, or -1 when the state is bad
// (*refused: with its own message).
static int state_line(run *r, char *line, uint64_t *slot_id, uint32_t *slot_at, uint32_t *slots, warrior **last,
                      int *refused) {
  params *p = &r->p;
  if (!strncmp(line, "slot ", 5)) { // before the member lines; states before them have none
    if (*slots >= r->cap || sscanf(line + 5, "%" SCNu64 " %u", &slot_id[*slots], &slot_at[*slots]) != 2 ||
        slot_at[*slots] < r->panel_n || slot_at[*slots] >= r->cap)
      return -1;
    (*slots)++;
    return 0;
  }
  if (sscanf(line, "batch %u", &r->batch) == 1 || sscanf(line, "next %" SCNu64, &r->next_id) == 1 ||
      sscanf(line, "best %" SCNu64 " %lg", &r->best_id, &r->best_holdout) == 2 ||
      sscanf(line, "archive-next %u", &r->archive_next) == 1 || sscanf(line, "seen-next %u", &r->seen_next) == 1 ||
      !strncmp(line, "reserve-next ", 13) || !strncmp(line, "rotate-next ", 12) || // of --rotate, removed in #193
      !strncmp(line, "events ", 7) || !strcmp(line, "end"))
    return 0;
  if (!strncmp(line, "member ", 7)) {
    warrior *w = xmalloc(sizeof *w);
    int used = 0;
    w->kind = MEMBER;
    w->style_kind = -1;
    w->g = xmalloc(sizeof *w->g);
    if (sscanf(line + 7, "%" SCNu64 " %u %" SCNu64 " %" SCNu64 " %lg %u %u %u %n", &w->id, &w->born,
               &w->parents[0], &w->parents[1], &w->holdout, &w->adjective, &w->noun, &w->earlier, &used) != 8 ||
        w->adjective >= NAME_ADJECTIVES || w->noun >= NAME_NOUNS ||
        genome_load(w->g, line + 7 + used, p->rules.core_size, 0) != 0) {
      free_warrior(w); // a member that does not parse is not in a slot
      return -1;
    }
    w->w = make_warrior(w->g, &p->rules);
    w->origin = w->born; // a state from before the origin has no origin line
    name_text(w->name, sizeof w->name, w->adjective, w->noun, w->earlier);
    uint32_t at = UINT32_MAX;
    for (uint32_t k = 0; k < *slots; k++)
      if (slot_id[k] == w->id) at = slot_at[k];
    if (at != UINT32_MAX && r->slot[at]) {
      free_warrior(w); // its slot is taken
      return -1;
    }
    r->slot[at != UINT32_MAX ? at : free_slot(r)] = w;
    *last = w;
  } else if (!strncmp(line, "origin ", 7)) { // after its member line; states before have none
    if (!*last || sscanf(line + 7, "%u", &(*last)->origin) != 1) return -1;
  } else if (!strncmp(line, "kind ", 5)) { // after its member line; states before have none
    if (!*last || sscanf(line + 5, "%d", &(*last)->style_kind) != 1) return -1;
  } else if (!strncmp(line, "ops ", 4) || !strcmp(line, "ops")) {
    if (*last) snprintf((*last)->ops, sizeof (*last)->ops, "%s", line[3] ? line + 4 : "");
  } else if (!strncmp(line, "best-genome ", 12)) { // the warrior of best.red
    if (genome_load(&r->best_g, line + 12, p->rules.core_size, 0) != 0) return -1;
    r->best_g_set = 1;
  } else if (!strncmp(line, "tuned ", 6)) { // the warrior --tune-novel tuned for the next batch: it waits there
    fprintf(stderr, "42evolve: %s: --tune-novel was removed after 1.1.0 (#193)\n", r->dir);
    *refused = 1;
    return -1;
  } else if (!strncmp(line, "archive ", 8)) {
    int used = 0;
    if (r->archive_n >= ARCHIVE_MAX ||
        sscanf(line + 8, "%" SCNu64 " %u %n", &r->archive_id[r->archive_n], &r->archive_noun[r->archive_n], &used) != 2 ||
        r->archive_noun[r->archive_n] >= NAME_NOUNS ||
        genome_load(&r->archive[r->archive_n], line + 8 + used, p->rules.core_size, 0) != 0)
      return -1;
    r->archive_n++;
  } else if (!strncmp(line, "names ", 6)) {
    uint32_t i, n;
    if (sscanf(line + 6, "%u %u", &i, &n) != 2 || i >= NAME_ADJECTIVES * NAME_NOUNS) return -1;
    r->names[i] = n;
  } else if (!strncmp(line, "score ", 6)) {
    uint64_t a, b;
    m42_score s;
    if (sscanf(line + 6, "%" SCNu64 " %" SCNu64 " %u %u %u", &a, &b, &s.wins, &s.losses, &s.ties) != 5) return -1;
    const uint32_t sa = slot_of_id(r, a), sb = slot_of_id(r, b);
    if (sa == UINT32_MAX || sb == UINT32_MAX) return -1;
    set_result(r, sa, sb, s);
    set_result1(r, sa, sb, s); // a state without score1 lines: the whole results stand for the first stage
  } else if (!strncmp(line, "score1 ", 7)) { // after the score line of the pair
    uint64_t a, b;
    m42_score s;
    if (sscanf(line + 7, "%" SCNu64 " %" SCNu64 " %u %u %u", &a, &b, &s.wins, &s.losses, &s.ties) != 5) return -1;
    const uint32_t sa = slot_of_id(r, a), sb = slot_of_id(r, b);
    if (sa == UINT32_MAX || sb == UINT32_MAX) return -1;
    set_result1(r, sa, sb, s);
  } else if (!strncmp(line, "seen ", 5)) {
    if (r->seen_n >= SEEN_MAX || sscanf(line + 5, "%" SCNx64, &r->seen[r->seen_n]) != 1) return -1;
    r->seen_n++;
  } else {
    return -1;
  }
  return 0;
}

int load_state(run *r, const char *path) {
  size_t len;
  char *text = read_file(path, &len);
  if (!text) return -1;
  state_lines s = {0};
  s.panel = xmalloc(len * sizeof *s.panel / 8 + 8), s.hold = xmalloc(len * sizeof *s.hold / 8 + 8);
  s.panel_id = xmalloc(len * sizeof *s.panel_id / 8 + 8);
  params *p = &r->p;
  char *save = 0;
  s.rest = xmalloc(len * sizeof(char *) / 4 + 8);
  int ok = 0, refused = 0;
  uint64_t *slot_id = 0; // the slot lines, freed also on the way out through bad
  uint32_t *slot_at = 0, slots = 0;
  // the lines that need the matrix come after the opponents are loaded
  char *line = strtok_r(text, "\n", &save);
  if (!line || strcmp(line, "42evolve-state 1") != 0) goto bad;
  for (line = strtok_r(0, "\n", &save); line; line = strtok_r(0, "\n", &save))
    if (state_head_line(r, line, &s, &refused) != 0) goto bad;
  p->rules.rounds = p->rounds;
  p->rules.warriors = 2;
  load_list(r, &r->panel, &r->panel_n, s.panel, s.pn, PANEL, 0);
  for (uint32_t i = 0; i < s.pn; i++) r->panel[i].id = s.panel_id[i];
  load_list(r, &r->hold, &r->hold_n, s.hold, s.hn, HOLDOUT, s.pn);
  if (r->list_grow) { // --list on a run that continues: more places, filled by children (not random warriors)
    if (r->list_grow < p->list) {
      fprintf(stderr, "42evolve: --list on a run that continues only grows the list (it has %u)\n", p->list);
      exit(2);
    }
    p->list = r->list_grow;
    p->fill = 0;
  }
  setup_matrix(r);
  warrior *last = 0;
  slot_id = xmalloc(r->cap * sizeof *slot_id);
  slot_at = xmalloc(r->cap * sizeof *slot_at);
  for (uint32_t i = 0; i < s.rn; i++)
    if (state_line(r, s.rest[i], slot_id, slot_at, &slots, &last, &refused) != 0) goto bad;
  rebuild_active(r);
  compute_values(r);
  ok = 1;
bad:
  free(slot_id);
  free(slot_at);
  free(text);
  free(s.panel);
  free(s.panel_id);
  free(s.hold);
  free(s.rest);
  if (!ok && !refused) fprintf(stderr, "42evolve: %s is not a state file of this version\n", path);
  return ok ? 0 : -1;
}

long state_events_size(const char *path) {
  size_t len;
  char *text = read_file(path, &len);
  long size = -1;
  const char *e = text ? strstr(text, "\nevents ") : 0;
  if (e) size = strtol(e + 8, 0, 10);
  free(text);
  return size;
}

void islands_save(const islands *I) {
  char path[1100], tmp[1110];
  snprintf(path, sizeof path, "%s/islands.txt", I->dir);
  snprintf(tmp, sizeof tmp, "%s.tmp", path);
  FILE *f = fopen(tmp, "w");
  if (!f) {
    fprintf(stderr, "42evolve: cannot write %s\n", tmp);
    exit(1);
  }
  fprintf(f, "42evolve-islands 1\nislands %u %u %u %u %u %" PRIu64 " %.17g %u\nlive", I->n, I->keep, I->every, I->selected,
          I->next_score, I->seed, I->best, I->rounds);
  for (uint32_t i = 0; i < I->n; i++) fprintf(f, " %u", I->live[i]);
  fprintf(f, "\nmigrate %u %u %u\nexplorers %u\n", I->migrate, I->migrate_random, I->migrate_next, I->explorers);
  fclose(f);
  if (rename(tmp, path) != 0) {
    fprintf(stderr, "42evolve: cannot write %s\n", path);
    exit(1);
  }
}

int islands_load(islands *I) {
  char path[1100];
  snprintf(path, sizeof path, "%s/islands.txt", I->dir);
  FILE *f = fopen(path, "r");
  if (!f) return -1;
  int ok = fscanf(f, "42evolve-islands 1 islands %u %u %u %u %u %" SCNu64 " %lg %u live", &I->n, &I->keep, &I->every, &I->selected,
                  &I->next_score, &I->seed, &I->best, &I->rounds) == 8 && I->n >= 1 && I->n <= ISLANDS_MAX && I->rounds;
  for (uint32_t i = 0; ok && i < I->n; i++) {
    unsigned v;
    ok = fscanf(f, "%u", &v) == 1 && v <= 1;
    I->live[i] = (uint8_t)v;
  }
  if (ok && fscanf(f, " migrate %u", &I->migrate) != 1) I->migrate = 0; // a state from before --migrate
  if (ok && fscanf(f, "%u %u", &I->migrate_random, &I->migrate_next) != 2) I->migrate_random = I->migrate_next = 0; // or its picks
  // a state from before #193: --leaf-restart, --nemesis-every and the batch
  // each island started at (a nemesis island's), all 0 unless it used them
  unsigned leaf = 0, nemesis = 0, later = 0;
  if (ok && fscanf(f, "%u", &leaf) != 1) leaf = 0;
  if (ok && fscanf(f, " nemesis %u", &nemesis) != 1) nemesis = 0;
  int since = -1;
  if (ok && fscanf(f, " since%n", &since) >= 0 && since > 0)
    for (uint32_t i = 0; i < I->n; i++) {
      unsigned b = 0;
      if (fscanf(f, "%u", &b) == 1) later |= b;
    }
  if (ok && fscanf(f, " explorers %u", &I->explorers) != 1) I->explorers = 0; // a state from before --explorers
  fclose(f);
  if (!ok) {
    fprintf(stderr, "42evolve: %s is not a state of islands\n", path);
    return -1;
  }
  const char *gone = I->migrate_next == 1 ? "--migrate-to next" : I->migrate_next == 3 ? "--migrate-to tree"
                     : leaf                ? "--leaf-restart"
                     : nemesis || later    ? "--nemesis-every"
                                           : 0;
  if (gone || (I->migrate_next != MIGRATE_ALL && I->migrate_next != MIGRATE_RANDOM)) {
    if (gone) fprintf(stderr, "42evolve: %s: %s was removed after 1.1.0 (#193)\n", I->dir, gone);
    else fprintf(stderr, "42evolve: %s is not a state of islands\n", path);
    return -1;
  }
  return 0;
}
