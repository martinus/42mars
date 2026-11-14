// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

#include "names.h"

#include <stdio.h>

static const char *const ADJECTIVES[NAME_ADJECTIVES] = {
    "Crimson",  "Silent",    "Rusty",     "Feral",     "Quantum",  "Nimble",    "Brazen",    "Hollow",
    "Sly",      "Molten",    "Frantic",   "Lucky",     "Grim",     "Jolly",     "Wobbly",    "Furious",
    "Sneaky",   "Cosmic",    "Electric",  "Gilded",    "Haunted",  "Itchy",     "Jagged",    "Kinetic",
    "Lazy",     "Mad",       "Neon",      "Obsidian",  "Patient",  "Quirky",    "Restless",  "Savage",
    "Tiny",     "Unruly",    "Vicious",   "Wicked",    "Zealous",  "Ancient",   "Bitter",    "Clever",
    "Daring",   "Eager",     "Fickle",    "Giddy",     "Hungry",   "Icy",       "Jumpy",     "Keen",
    "Lunar",    "Merry",     "Noble",     "Odd",       "Plucky",   "Rabid",     "Scarlet",   "Thorny",
    "Velvet",   "Wild",      "Zany",      "Atomic",    "Binary",   "Chaotic",   "Dizzy",     "Echoing",
    "Fuzzy",    "Glitchy",   "Hyper",     "Infinite",  "Jittery",  "Looping",   "Mutant",    "Nervous",
    "Orbital",  "Pixelated", "Quiet",     "Recursive", "Spinning", "Turbo",     "Unstable",  "Volatile",
    "Wandering", "Yawning",  "Zesty",     "Blazing",   "Cunning",  "Doomed",    "Eternal",   "Fearless",
    "Ghostly",  "Humble",    "Iron",      "Jade",      "Lone",     "Mighty",    "Nocturnal", "Overclocked",
    "Prickly",  "Rogue",     "Shadowy",   "Stealthy",  "Twisted",  "Undying",   "Vengeful",  "Whirling",
    "Spiky",    "Smug",      "Grumpy",    "Bouncy",    "Cranky",   "Fancy",     "Feisty",    "Sleepy",
    "Stubborn", "Tricky",    "Wiry",      "Crispy",    "Soggy",    "Salty",     "Spicy",     "Toxic",
    "Rapid",    "Silver",    "Golden",    "Hasty",     "Mellow",   "Polite",    "Rowdy",     "Sinister",
};

static const char *const NOUNS[NAME_NOUNS] = {
    "Mantis",    "Viper",     "Imp",       "Dwarf",     "Gremlin",  "Kraken",    "Badger",    "Hornet",
    "Weasel",    "Moth",      "Goblin",    "Golem",     "Wraith",   "Phantom",   "Raccoon",   "Octopus",
    "Ferret",    "Lobster",   "Scorpion",  "Jackal",    "Piranha",  "Vulture",   "Beetle",    "Spider",
    "Hydra",     "Basilisk",  "Chimera",   "Wombat",    "Narwhal",  "Platypus",  "Mongoose",  "Panther",
    "Falcon",    "Raven",     "Cobra",     "Shark",     "Squid",    "Termite",   "Locust",    "Tardigrade",
    "Axolotl",   "Pangolin",  "Porcupine", "Hedgehog",  "Yeti",     "Troll",     "Ogre",      "Banshee",
    "Specter",   "Djinn",     "Sprite",    "Pixie",     "Kobold",   "Wyvern",    "Griffin",   "Minotaur",
    "Cyclops",   "Leech",     "Mosquito",  "Wasp",      "Bumblebee", "Ant",      "Crab",      "Barnacle",
    "Jellyfish", "Eel",       "Stingray",  "Marmot",    "Lemur",    "Gibbon",    "Otter",     "Mole",
    "Shrew",     "Vole",      "Stoat",     "Lynx",      "Ocelot",   "Coyote",    "Hyena",     "Dingo",
    "Bison",     "Yak",       "Moose",     "Walrus",    "Puffin",   "Pelican",   "Heron",     "Magpie",
    "Crow",      "Owl",       "Kestrel",   "Condor",    "Gecko",    "Iguana",    "Newt",      "Toad",
    "Salamander", "Python",   "Mamba",     "Adder",     "Raptor",   "Dragon",    "Phoenix",   "Automaton",
    "Robot",     "Drone",     "Virus",     "Worm",      "Daemon",   "Kernel",    "Glitch",    "Bomber",
    "Scanner",   "Vampire",   "Zombie",    "Ghoul",     "Mummy",    "Werewolf",  "Kitten",    "Hamster",
    "Llama",     "Penguin",   "Koala",     "Sloth",     "Mammoth",  "Dodo",      "Gargoyle",  "Poltergeist",
};

const char *name_adjective(uint32_t i) { return ADJECTIVES[i % NAME_ADJECTIVES]; }
const char *name_noun(uint32_t i) { return NOUNS[i % NAME_NOUNS]; }

int name_roman(char *buf, size_t n, uint32_t v) {
  if (v < 1 || v > 3999) return snprintf(buf, n, "%u", v);
  static const uint32_t value[] = {1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1};
  static const char *const digit[] = {"M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"};
  char out[24];
  int len = 0;
  for (int i = 0; i < 13; i++)
    for (; v >= value[i]; v -= value[i])
      for (const char *d = digit[i]; *d;) out[len++] = *d++;
  out[len] = 0;
  return snprintf(buf, n, "%s", out);
}

int name_text(char *buf, size_t n, uint32_t adjective, uint32_t noun, uint32_t earlier) {
  if (!earlier) return snprintf(buf, n, "%s %s", name_adjective(adjective), name_noun(noun));
  char roman[24];
  name_roman(roman, sizeof roman, earlier + 1);
  return snprintf(buf, n, "%s %s %s", name_adjective(adjective), name_noun(noun), roman);
}
