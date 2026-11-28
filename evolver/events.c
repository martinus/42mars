// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The events of events.jsonl (docs/evolver.md): JSON strings, the start of
// a run, the panel's matches among each other, a member that enters or
// leaves, the values after a batch. An event of one step alone (bench,
// screen, batch, speed, migrate, score, ...) is written by that step.

#include "evolve.h"

// ---------------------------------------------------------------- JSON

// A JSON string; latin1: bytes 0x80..0xff are Latin-1 characters (warrior files).
void json_str(FILE *f, const char *s, int latin1) {
  fputc('"', f);
  for (const unsigned char *p = (const unsigned char *)s; *p; p++) {
    const unsigned c = *p;
    if (c == '"' || c == '\\') fprintf(f, "\\%c", c);
    else if (c == '\n') fputs("\\n", f);
    else if (c == '\t') fputs("\\t", f);
    else if (c < 0x20 || c == 0x7f) fprintf(f, "\\u%04x", c);
    else if (c >= 0x80 && latin1) fprintf(f, "\\u%04x", c);
    else if (c >= 0x80) fputc('?', f);
    else fputc((int)c, f);
  }
  fputc('"', f);
}

// ---------------------------------------------------------------- events

// The text of g's generator, to be freed; 0 when g is a list.
char *generator_text(const genome *g, uint32_t core) {
  if (!g->generated) return 0;
  const size_t n = gen_text(&g->p, core, 0, 0) + 1;
  char *text = xmalloc(n);
  gen_text(&g->p, core, text, n);
  return text;
}

// The warrior's code, and behind it "gen": its generator (--genome gen).
static void write_code(FILE *f, const genome *g, uint32_t core) {
  char text[GENOME_MAX * 48 + 64];
  genome_text(g, core, text, sizeof text);
  json_str(f, text, 0);
  char *gen = generator_text(g, core);
  if (!gen) return;
  fputs(",\"gen\":", f);
  json_str(f, gen, 0);
  free(gen);
}

void event_start(run *r) {
  FILE *f = r->events;
  const params *p = &r->p;
  fprintf(f,
          "{\"type\":\"start\",\"version\":\"%s\",\"rules\":{\"size\":%u,\"cycles\":%u,\"processes\":%u,\"length\":%u,"
          "\"distance\":%u},\"params\":{\"panel\":%u,\"holdout\":%u,\"list\":%u,\"batch\":%u,\"survivors\":%u,"
          "\"rounds\":%u,\"screenRounds\":%u,\"benchEvery\":%u,\"benchRounds\":%u,\"initLength\":%u,"
          "\"screenFactor\":%.17g,\"alpha\":%.17g,\"reintroduce\":%.17g,\"sd\":\"%s\",\"seed\":%" PRIu64
          ","
          "\"parents\":\"%s\",\"screenMembers\":%u,\"stage\":%u,\"fill\":%s,\"panelRounds\":%u,\"diversity\":\"%s\",\"panelChoice\":\"%s\",\"screenStop\":%.17g,\"screenCheck\":%.17g,\"average\":\"%s\",\"memberGames\":\"%s\",\"drawSeed\":%" PRIu64 ",\"pushoff\":\"%s\",\"positions\":\"%s\",\"clear\":%.17g,\"genome\":\"%s\",\"minLength\":%u,\"tiePoints\":%.17g,\"parsimony\":%s,\"noSpl\":%s,\"survivorsBy\":\"%s\",\"replaceParent\":%s,\"events\":\"%s\",\"ladder\":%s,\"ladderEvery\":%u,\"ladderAbove\":%.17g,\"yieldHalf\":%u,\"changesLearn\":%s,\"learnEvery\":%u,\"learnWindow\":%u},"
          "\"opponents\":",
          m42_version(), p->rules.core_size, p->rules.max_cycles, p->rules.max_processes, p->rules.max_length,
          p->rules.min_distance, r->panel_n, r->hold_n, p->list, p->batch, p->survivors, p->rounds, p->screen_rounds,
          p->bench_every, p->bench_rounds, p->init_length, p->screen_factor, p->alpha, p->reintroduce,
          p->sd == SD_SUM ? "sum" : "opponent", p->seed,
          p->parents == PARENTS_DUEL ? "duel" : p->parents == PARENTS_YIELD ? "yield" : "value", p->screen_members, p->stage,
          p->fill ? "true" : "false", panel_rounds(p), p->distance_panel ? "panel" : "all",
          p->panel_files[0]                 ? "files"
          : p->panel_random == PANEL_RANDOM ? "random"
          : p->panel_random == PANEL_KINDS  ? "kinds"
                                            : "picked",
          p->screen_stop, p->screen_check,
          p->average_panel ? "panel" : "all", p->member_games_none ? "none" : "all", p->draw_seed,
          p->pareto == 3 ? "pareto-sd" : p->pareto ? "pareto" : "value", p->mirror ? "mirror" : "pmars", p->clear, p->gen ? "gen" : "list", p->min_length, p->tie,
          p->parsimony ? "true" : "false", p->no_spl ? "true" : "false",
          p->survivors_by ? "pushoff" : "strength", p->replace_parent ? "true" : "false", p->events_brief ? "brief" : "full",
          p->ladder ? "true" : "false", p->ladder_every, p->ladder_above, p->yield_half,
          p->changes_learn ? "true" : "false", p->learn_every, p->learn_window);
  json_str(f, p->opponents, 0);
  fputs(",\"panelFiles\":", f);
  json_str(f, p->panel_files, 0);
  fputs(",\"start\":", f);
  json_str(f, p->start, 0);
  fputs(",\"startWarriors\":[", f);
  for (uint32_t i = 0; i < r->start_n; i++) {
    fputs(i ? ",{\"name\":" : "{\"name\":", f);
    json_str(f, r->start_name[i], 1);
    fputs(",\"file\":", f);
    json_str(f, r->start_file[i], 1);
    fprintf(f, ",\"family\":\"%s\"}", name_noun(r->start_noun[i]));
  }
  fputs("],\"changes\":{", f);
  for (int k = 0; k < (p->gen ? CH_ALL : CH_COUNT); k++) // a run on generators: the kinds that make structure too
    fprintf(f, "%s\"%s\":%u", k ? "," : "", genome_change_name(k), p->changes.w[k]);
  fputc('}', f);
  for (int k = 0; k < 2; k++) {
    fputs(k ? ",\"holdout\":[" : ",\"panel\":[", f);
    const uint32_t n = k ? r->hold_n : r->panel_n;
    for (uint32_t i = 0; i < n; i++) {
      const warrior *w = k ? &r->hold[i] : &r->panel[i];
      fprintf(f, "%s{\"id\":%" PRIu64 ",\"name\":", i ? "," : "", w->id);
      json_str(f, w->name, 1);
      fputs(",\"author\":", f);
      json_str(f, w->author, 1);
      fputs(",\"file\":", f);
      json_str(f, w->file, 1);
      fputs(",\"source\":", f);
      json_str(f, w->source, 1);
      fputc('}', f);
    }
    fputc(']', f);
  }
  fputs("}\n", f);
}

// The matches of the panel among each other: [a, b, wins, losses, ties, seed]
// with a the higher id, warrior 0 of the match.
void event_panel(run *r) {
  FILE *f = r->events;
  fputs("{\"type\":\"panel\",\"scores\":[", f);
  int first = 1;
  for (uint32_t a = 0; a < r->panel_n; a++)
    for (uint32_t b = 0; b < a; b++) {
      const m42_score s = r->wlt[a * r->cap + b];
      fprintf(f, "%s[%" PRIu64 ",%" PRIu64 ",%u,%u,%u,%" PRId64 "]", first ? "" : ",", r->panel[a].id, r->panel[b].id,
              s.wins, s.losses, s.ties, seed_for(r, r->panel[b].id));
      first = 0;
    }
  if (stage_rounds(&r->p) < r->p.rounds) { // --stage: the first stage's results too
    fputs("],\"scores1\":[", f);
    first = 1;
    for (uint32_t a = 0; a < r->panel_n; a++)
      for (uint32_t b = 0; b < a; b++) {
        const m42_score s = r->wlt1[a * r->cap + b];
        fprintf(f, "%s[%" PRIu64 ",%" PRIu64 ",%u,%u,%u]", first ? "" : ",", r->panel[a].id, r->panel[b].id, s.wins,
                s.losses, s.ties);
        first = 0;
      }
  }
  fputs("]}\n", f);
}

// A new member: its results against every warrior in, [other, wins, losses,
// ties, seed], the new member warrior 0 of each match.
// pick: with --survivors-by pushoff the newcomer's estimated place in the
// push-off from its screen (pushoff_keys()): [front, 0 the first; average
// against the panel; against the members of the screen; SD-score to the
// nearest warrior], else 0.
// --events brief (#187): the place of a line of the batch in memory, for
// run_batch(); brief: the enter line for a newcomer that leaves in the batch.
void mark_line(run *r, long start, uint64_t id, char *brief) {
  if (r->marks_n == r->marks_cap) {
    r->marks_cap = r->marks_cap ? 2 * r->marks_cap : 256;
    struct event_mark *m = xmalloc(r->marks_cap * sizeof *m);
    if (r->marks_n) memcpy(m, r->marks, r->marks_n * sizeof *m);
    free(r->marks);
    r->marks = m;
  }
  r->marks[r->marks_n++] = (struct event_mark){start, ftell(r->events), id, brief};
}

// The brief enter line of a newcomer (--events brief): what the operators,
// the lineage and the ticker need, without its matches, screen points, code
// and generator; avg: its average against the panel when it entered.
static char *brief_enter(const run *r, const warrior *w, double screen, double estimate, double avg) {
  char *text = 0;
  size_t n = 0;
  FILE *f = open_memstream(&text, &n);
  if (!f) {
    fprintf(stderr, "42evolve: out of memory\n");
    exit(1);
  }
  fprintf(f, "{\"type\":\"enter\",\"batch\":%u,\"id\":%" PRIu64 ",\"name\":", r->batch, w->id);
  json_str(f, w->name, 0);
  fputs(",\"parents\":[", f);
  for (int k = 0, c = 0; k < 2; k++)
    if (w->parents[k] != NO_ID) fprintf(f, "%s%" PRIu64, c++ ? "," : "", w->parents[k]);
  fputs("],\"ops\":", f);
  json_str(f, w->ops, 0);
  fprintf(f, ",\"length\":%u,\"screen\":%.4f,\"estimate\":%.6f,\"style\":{\"kind\":\"%s\"},\"newFamily\":%s,\"origin\":%u,"
             "\"panelAvg\":%.4f,\"brief\":true}\n",
          w->g->len, screen, estimate, style_kind_name(w->style_kind), w->new_family ? "true" : "false", w->origin, avg);
  fclose(f);
  return text;
}

void event_enter(run *r, uint32_t slot, double screen, double estimate, uint64_t rival,
                        const unit *row, const double *pick) {
  FILE *f = r->events;
  const warrior *w = r->slot[slot];
  const long start = r->buffering ? ftell(f) : 0;
  fprintf(f, "{\"type\":\"enter\",\"batch\":%u,\"id\":%" PRIu64 ",\"name\":", r->batch, w->id);
  json_str(f, w->name, 0);
  fputs(",\"parents\":[", f);
  for (int k = 0, n = 0; k < 2; k++)
    if (w->parents[k] != NO_ID) fprintf(f, "%s%" PRIu64, n++ ? "," : "", w->parents[k]);
  fputs("],\"ops\":", f);
  json_str(f, w->ops, 0);
  fprintf(f, ",\"length\":%u,\"screen\":%.4f,\"estimate\":%.6f,\"screenPoints\":[", w->g->len, screen, estimate);
  for (uint32_t k = 0; k < r->panel_n; k++) fprintf(f, "%s%.4f", k ? "," : "", points_t(row[k].s[0], r->p.screen_rounds, r->p.tie));
  fputc(']', f);
  if (pick) fprintf(f, ",\"pick\":[%.0f,%.17g,%.17g,%.17g]", pick[0], pick[1], pick[2], pick[3]);
  fprintf(f, ",\"style\":{\"kind\":\"%s\",\"copies\":%.6f,\"moved\":%.6f,\"written\":%.6f,\"whole\":%.6f,\"read\":%.6f,"
          "\"tasks\":%.6f,\"alive\":%.6f,\"measured\":%.6f}",
          style_kind_name(w->style_kind), w->st.copies, w->st.moved, w->st.written, w->st.whole, w->st.read, w->st.tasks,
          w->st.alive, w->st.measured);
  // raceKey: 0 since --race went (#193), as it was without it
  fprintf(f, ",\"raceKey\":0.000000,\"rival\":%" PRId64 ",\"parentDifference\":%.6f,\"newFamily\":%s,\"origin\":%u,\"code\":",
          rival == NO_ID ? (int64_t)-1 : (int64_t)rival, w->parent_difference, w->new_family ? "true" : "false",
          w->origin);
  write_code(f, w->g, r->p.rules.core_size);
  fputs(",\"scores\":[", f);
  int first = 1;
  for (uint32_t i = 0; i < r->active_n; i++) {
    const uint32_t o = r->active[i];
    if (o == slot) continue;
    if (r->p.member_games_none && o >= r->panel_n) continue; // --member-games none: no games against members
    const m42_score s = r->wlt[slot * r->cap + o];
    fprintf(f, "%s[%" PRIu64 ",%u,%u,%u,%" PRId64 "]", first ? "" : ",", r->slot[o]->id, s.wins, s.losses, s.ties,
            seed_for(r, r->slot[o]->id));
    first = 0;
  }
  fputs("]}\n", f);
  if (r->buffering) mark_line(r, start, w->id, brief_enter(r, w, screen, estimate, panel_avg(r, slot)));
}

// early: decided on the results of the first stage (--stage), the values too
// twin (--parsimony): the id of the warrior with the same results that
// stays, NO_ID when the push-off decided.
// twin: with --parsimony the id of the twin that stays; parent_duel: with
// --replace-parent the id of the winner of the duel of a newcomer and its
// first parent; NO_ID when not.
void event_leave(run *r, const pushoff_value *v, int early, uint64_t twin, uint64_t parent_duel) {
  const warrior *w = r->slot[v->index];
  if (r->buffering && w->kind == MEMBER && w->born == r->batch) { // a newcomer of this batch: run_batch() writes it brief
    if (r->gone_n == r->gone_cap) {
      r->gone_cap = r->gone_cap ? 2 * r->gone_cap : 256;
      uint64_t *g = xmalloc(r->gone_cap * sizeof *g);
      if (r->gone_n) memcpy(g, r->gone, r->gone_n * sizeof *g);
      free(r->gone);
      r->gone = g;
    }
    r->gone[r->gone_n++] = w->id;
  }
  fprintf(r->events,
          "{\"type\":\"leave\",\"batch\":%u,\"id\":%" PRIu64 ",\"avg\":%.6f,\"distance\":%.6f,\"nearest\":%" PRId64
          ",\"value\":%.6f%s",
          r->batch, r->slot[v->index]->id, v->avg, v->distance,
          v->nearest == UINT32_MAX ? (int64_t)-1 : (int64_t)r->slot[v->nearest]->id, v->value,
          early ? ",\"early\":true" : "");
  if (twin != NO_ID) fprintf(r->events, ",\"twin\":%" PRIu64, twin);
  if (parent_duel != NO_ID) fprintf(r->events, ",\"duel\":%" PRIu64, parent_duel);
  fputs("}\n", r->events);
}

// The values of everyone in after the batch: [id, avg, distance, nearest,
// value, panel average].
void event_values(run *r) {
  FILE *f = r->events;
  fprintf(f, "{\"type\":\"values\",\"batch\":%u,\"values\":[", r->batch);
  for (uint32_t i = 0; i < r->active_n; i++) {
    const pushoff_value *v = &r->values[i];
    fprintf(f, "%s[%" PRIu64 ",%.6f,%.6f,%" PRId64 ",%.6f,%.6f]", i ? "," : "", r->slot[v->index]->id, v->avg,
            v->distance, v->nearest == UINT32_MAX ? (int64_t)-1 : (int64_t)r->slot[v->nearest]->id, v->value,
            panel_avg(r, v->index));
  }
  fputs("]}\n", f);
}
