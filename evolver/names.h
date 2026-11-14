// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Names of evolved warriors: an adjective of its own and the noun of its
// family, which a child takes from its first parent ("Crimson Mantis" ->
// "Sneaky Mantis"). A name given before gets a Roman numeral ("Sneaky
// Mantis II"), so every name of a run is unique.

#ifndef EVOLVER_NAMES_H
#define EVOLVER_NAMES_H

#include <stddef.h>
#include <stdint.h>

#define NAME_ADJECTIVES 128u
#define NAME_NOUNS 128u

// The words, for the tests.
const char *name_adjective(uint32_t i);
const char *name_noun(uint32_t i);

// "Adjective Noun", with " II", " III" ... when `earlier` warriors had that
// name before (0: none). Like snprintf.
int name_text(char *buf, size_t n, uint32_t adjective, uint32_t noun, uint32_t earlier);

// The Roman numeral of v (1 .. 3999), else v in digits. Like snprintf.
int name_roman(char *buf, size_t n, uint32_t v);

#endif
