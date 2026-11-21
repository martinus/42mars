# Evolved warriors

Warriors that `42evolve` (`evolver/`, [`docs/evolver.md`](../../docs/evolver.md)) evolved, each the `best.red` of a run or of an island, under the MIT license of this repository like the rest of the code. One folder per hill, since a warrior is evolved for the rules and opponents of one.

Each file is the `best.red` as the run wrote it, with one line added: `;strategy from run <run>, <date>, --pushoff <push-off>`. The other `;strategy` lines say which warrior of the run it was, the batch it was found in, and its score against the run's holdout. The name is the warrior's own (an adjective and the noun of its family, Roman numerals for repeats); a name that two runs gave to different code has the run's name added. The same code from two runs is here once, the table names both runs.

The tables are sorted by the score against the holdout: points per 100 rounds against the 100 warriors of the hill that run kept out of its panel. Each run drew its own holdout, so these scores compare only roughly. "Whole hill" is the score against every warrior of the hill, 100 rounds each, where the run measured it (folders of islands, `--islands`); that one compares across runs. "Batch" is when the warrior was found, as far as the run says.

The runs of 14th to 19th November 2026 are in this first collection: the E5 comparisons and the push-off comparisons of `docs/evolver.md`. Fancy Falcon (21st November) is the first from a run on generators (`--genome gen`, #174): 16 islands, half of them screening against every member, each taking a member drawn from an island drawn every 5 batches; 117.0 against the whole hill, 6.7 above the best before it.

## '94 hill without p-space: `94nop/`, 165 warriors

Rules: pMARS's defaults: core 8000, 80,000 cycles, 8000 processes, length 100, distance 100; opponents `warriors/koenigstuhl/94nop`.

| warrior | length | holdout | whole hill | run | push-off | batch | date |
|---|---|---|---|---|---|---|---|
| [Restless Gremlin](94nop/restless-gremlin.red) | 5 | 142.5 |  | `isl11` | value | 679 | 16th November 2026 |
| [Spiky Mongoose XVI](94nop/spiky-mongoose-xvi.red) | 4 | 142.2 |  | `mrg2` | value | 129 | 16th November 2026 |
| [Cranky Mongoose VI](94nop/cranky-mongoose-vi.red) | 4 | 141.5 |  | `mrg1` | value | 109 | 16th November 2026 |
| [Giddy Locust XX](94nop/giddy-locust-xx.red) | 27 | 140.2 |  | `s-seeded` | value | 169 | 14th November 2026 |
| [Toxic Locust V](94nop/toxic-locust-v.red) | 13 | 138.5 |  | `m-seed-mix` | value | 109 | 15th November 2026 |
| [Hyper Wombat XXVI](94nop/hyper-wombat-xxvi.red) | 15 | 136.4 |  | `sps2` | value | 179 | 16th November 2026 |
| [Humble Locust VII](94nop/humble-locust-vii.red) | 10 | 135.7 |  | `n1-seed` | value | 59 | 15th November 2026 |
| [Haunted Locust XLIII](94nop/haunted-locust-xliii.red) | 27 | 135.4 |  | `s-seeded-prior` | value | 249 | 14th November 2026 |
| [Humble Sloth V](94nop/humble-sloth-v.red) | 7 | 134.8 |  | `kd1b`, `kd1b-ctl`, `kd1b-l200`, `kd1b-tn` | value | 8249 | 16th November 2026 |
| [Restless Wombat XVI](94nop/restless-wombat-xvi.red) | 10 | 134.0 |  | `ss2` | value | 109 | 16th November 2026 |
| [Patient Locust IX](94nop/patient-locust-ix.red) | 12 | 133.1 |  | `m-seed` | value | 49 | 15th November 2026 |
| [Polite Wombat VII](94nop/polite-wombat-vii.red) | 9 | 133.1 |  | `sk2` | value | 59 | 16th November 2026 |
| [Jagged Glitch](94nop/jagged-glitch.red) | 4 | 132.7 |  | `w1-ap24` | value | 9 | 17th November 2026 |
| [Nocturnal Kitten XLI](94nop/nocturnal-kitten-xli.red) | 7 | 131.9 |  | `kd1`, `kd1a`, `kd1c` | value | 4269 | 15th November 2026 |
| [Scarlet Dodo II](94nop/scarlet-dodo-ii.red) | 5 | 131.1 |  | `pd80` | value | 3369 | 15th November 2026 |
| [Brazen Spider](94nop/brazen-spider.red) | 6 | 131.1 |  | `w1-ap21` | value | 9 | 17th November 2026 |
| [Twisted Jackal II](94nop/twisted-jackal-ii.red) | 4 | 130.6 |  | `ap24`, `r-ap24` | value | 1679 | 17th November 2026 |
| [Tiny Locust III](94nop/tiny-locust-iii.red) | 17 | 129.3 |  | `s100-seed` | value | 9 | 15th November 2026 |
| [Unstable Condor](94nop/unstable-condor.red) | 4 | 128.5 |  | `ctl4` | value | 439 | 16th November 2026 |
| [Salty Gecko](94nop/salty-gecko.red) | 4 | 128.4 |  | `s1-ap24`, `s3-ap24` | value | 9 | 17th November 2026 |
| [Hasty Dingo](94nop/hasty-dingo.red) | 6 | 127.3 |  | `ap21`, `r-ap21` | value | 719 | 17th November 2026 |
| [Sneaky Octopus](94nop/sneaky-octopus.red) | 6 | 123.4 |  | `s3-ap21` | value | 29 | 17th November 2026 |
| [Spiky Octopus](94nop/spiky-octopus.red) | 6 | 123.1 |  | `s1-ap21` | value | 9 | 17th November 2026 |
| [Molten Bison](94nop/molten-bison.red) | 3 | 122.0 |  | `ap23`, `r-ap23` | value | 609 | 16th November 2026 |
| [Zesty Kestrel](94nop/zesty-kestrel.red) | 3 | 120.8 |  | `me1` | value | 119 | 15th November 2026 |
| [Silver Condor](94nop/silver-condor.red) | 5 | 120.7 |  | `long30` | pareto-age | 1339 | 18th November 2026 |
| [Spinning Worm](94nop/spinning-worm.red) | 5 | 120.3 |  | `tn4` | value | 759 | 16th November 2026 |
| [Lone Gibbon XVII](94nop/lone-gibbon-xvii.red) | 2 | 119.8 |  | `i55-41` | value | 169 | 17th November 2026 |
| [Quirky Puffin](94nop/quirky-puffin.red) | 7 | 119.2 |  | `w1-ap23` | value | 9 | 17th November 2026 |
| [Patient Wasp](94nop/patient-wasp.red) | 4 | 118.2 |  | `s1-ap23`, `s3-ap23` | value | 9 | 17th November 2026 |
| [Undying Imp](94nop/undying-imp.red) | 3 | 117.8 |  | `pareto30` | pareto | 59 | 17th November 2026 |
| [Shadowy Gecko](94nop/shadowy-gecko.red) | 7 | 116.3 |  | `w1-ap22` | value | 69 | 17th November 2026 |
| [Lucky Ocelot III](94nop/lucky-ocelot-iii.red) | 4 | 116.0 |  | `al23` | value | 1649 | 16th November 2026 |
| [Noble Imp](94nop/noble-imp.red) | 6 | 116.0 |  | `pdm80` | value | 559 | 15th November 2026 |
| [Feral Yeti II](94nop/feral-yeti-ii.red) | 10 | 115.1 |  | `r-ap22` | value | 869 | 17th November 2026 |
| [Lazy Sloth](94nop/lazy-sloth.red) | 3 | 114.3 |  | `isl13` | value | 239 | 16th November 2026 |
| [Patient Gargoyle](94nop/patient-gargoyle.red) | 3 | 114.0 |  | `i55-51` | value | 329 | 17th November 2026 |
| [Fancy Falcon](94nop/fancy-falcon.red) | 3 | 112.8 | 117.0 | `gen-var16-rnd/island-15` | pareto-sd | 98 | 21st November 2026 |
| [Cunning Pelican XII](94nop/cunning-pelican-xii.red) | 2 | 112.3 |  | `i55-55` | value | 129 | 17th November 2026 |
| [Quiet Otter](94nop/quiet-otter.red) | 4 | 111.8 |  | `isl15` | value | 239 | 16th November 2026 |
| [Wobbly Zombie](94nop/wobbly-zombie.red) | 6 | 111.2 |  | `i20-55` | value | 219 | 17th November 2026 |
| [Jade Koala](94nop/jade-koala.red) | 4 | 110.4 |  | `an23`, `r-an23` | value | 179 | 17th November 2026 |
| [Scarlet Golem](94nop/scarlet-golem.red) | 2 | 110.3 |  | `all55`, `all55.batch134` | value | 39 | 17th November 2026 |
| [Eternal Bomber XXXIII](94nop/eternal-bomber-xxxiii.red) | 4 | 109.0 |  | `cmp-p3-83` | pareto-age | 469 | 18th November 2026 |
| [Stubborn Llama II](94nop/stubborn-llama-ii.red) | 5 | 108.5 |  | `isl17` | value | 59 | 16th November 2026 |
| [Haunted Minotaur II](94nop/haunted-minotaur-ii.red) | 9 | 108.0 |  | `al21` | value | 599 | 16th November 2026 |
| [Mutant Salamander](94nop/mutant-salamander.red) | 3 | 107.9 |  | `s1-an23`, `s3-an23` | value | 9 | 17th November 2026 |
| [Lazy Barnacle XXV](94nop/lazy-barnacle-xxv.red) | 2 | 107.7 |  | `i55-45` | value | 149 | 17th November 2026 |
| [Unstable Goblin III](94nop/unstable-goblin-iii.red) | 2 | 107.6 |  | `isl14` | value | 89 | 16th November 2026 |
| [Sly Tardigrade III](94nop/sly-tardigrade-iii.red) | 3 | 107.4 |  | `isl12` | value | 49 | 16th November 2026 |
| [Icy Mole XIII](94nop/icy-mole-xiii.red) | 2 | 107.1 |  | `isl16` | value | 149 | 16th November 2026 |
| [Haunted Lynx XVIII](94nop/haunted-lynx-xviii.red) | 26 | 107.1 |  | `np2` | value | 2149 | 16th November 2026 |
| [Grim Heron VII](94nop/grim-heron-vii.red) | 18 | 106.4 |  | `i20-41` | value | 69 | 17th November 2026 |
| [Mutant Kraken](94nop/mutant-kraken.red) | 3 | 105.1 |  | `islv/island-06` | value | 109 | 18th November 2026 |
| [Atomic Glitch](94nop/atomic-glitch.red) | 2 | 105.1 |  | `w1-an21`, `s1-an21`, `s3-an21` | value | 9 | 17th November 2026 |
| [Giddy Ghoul](94nop/giddy-ghoul.red) | 3 | 105.1 |  | `w1-an23` | value | 9 | 17th November 2026 |
| [Merry Phantom](94nop/merry-phantom.red) | 2 | 104.8 |  | `s1-an22`, `s3-an22` | value | 9 | 17th November 2026 |
| [Sleepy Puffin](94nop/sleepy-puffin.red) | 2 | 104.8 |  | `s1-ap22`, `s3-ap22` | value | 9 | 17th November 2026 |
| [Looping Gargoyle IV](94nop/looping-gargoyle-iv.red) | 2 | 104.7 |  | `kd2` | value | 49 | 15th November 2026 |
| [Vengeful Troll](94nop/vengeful-troll.red) | 2 | 104.6 |  | `me2` | value | 209 | 15th November 2026 |
| [Zealous Weasel VIII](94nop/zealous-weasel-viii.red) | 4 | 104.4 |  | `pareto30m` | pareto | 149 | 17th November 2026 |
| [Hungry Ant XI](94nop/hungry-ant-xi.red) | 4 | 104.3 |  | `isla/island-06` | pareto-age | 69 | 18th November 2026 |
| [Yawning Mosquito VII](94nop/yawning-mosquito-vii.red) | 2 | 103.9 |  | `islsd/island-08` | pareto-sd | 59 | 18th November 2026 |
| [Mellow Spider II](94nop/mellow-spider-ii.red) | 8 | 103.7 |  | `al24` | value | 559 | 16th November 2026 |
| [Undying Basilisk XVIII](94nop/undying-basilisk-xviii.red) | 2 | 103.7 |  | `cmp-p3-82` | pareto-age | 139 | 18th November 2026 |
| [Rowdy Automaton XV](94nop/rowdy-automaton-xv.red) | 2 | 103.7 |  | `islsda/island-05` | pareto-sd --difference ahead | 89 | 18th November 2026 |
| [Fancy Dingo VII](94nop/fancy-dingo-vii.red) | 3 | 103.6 |  | `islsd/island-05` | pareto-sd | 89 | 18th November 2026 |
| [Eager Wyvern VI](94nop/eager-wyvern-vi.red) | 2 | 103.5 |  | `cmp-p2-83` | pareto | 49 | 18th November 2026 |
| [Frantic Coyote II](94nop/frantic-coyote-ii.red) | 2 | 103.5 |  | `cmp-p3-84` | pareto-age | 39 | 18th November 2026 |
| [Hollow Imp](94nop/hollow-imp.red) | 2 | 103.4 |  | `an22`, `r-an22` | value | 119 | 17th November 2026 |
| [Silent Ant](94nop/silent-ant.red) | 2 | 103.4 |  | `cr2` | value | 39 | 15th November 2026 |
| [Golden Lobster XVII](94nop/golden-lobster-xvii.red) | 2 | 103.3 |  | `pdn80` | value | 189 | 15th November 2026 |
| [Orbital Tardigrade LXXVIII](94nop/orbital-tardigrade-lxxviii.red) | 10 | 103.2 |  | `s20` | value | 539 | 15th November 2026 |
| [Jittery Imp XLIII](94nop/jittery-imp-xliii.red) | 2 | 103.1 |  | `ap22` | value | 359 | 17th November 2026 |
| [Sleepy Badger XIV](94nop/sleepy-badger-xiv.red) | 2 | 102.9 |  | `al22` | value | 219 | 16th November 2026 |
| [Wobbly Beetle VI](94nop/wobbly-beetle-vi.red) | 2 | 102.7 | 106.2 | `islsd/island-07` | pareto-sd | 39 | 18th November 2026 |
| [Golden Kitten VII](94nop/golden-kitten-vii.red) | 2 | 102.6 |  | `isla/island-07` | pareto-age | 59 | 18th November 2026 |
| [Humble Mole](94nop/humble-mole.red) | 6 | 102.5 |  | `w1-an24` | value | 9 | 17th November 2026 |
| [Feral Wraith XI](94nop/feral-wraith-xi.red) | 2 | 102.4 |  | `islsda/island-06` | pareto-sd --difference ahead | 89 | 18th November 2026 |
| [Nimble Glitch VIII](94nop/nimble-glitch-viii.red) | 3 | 102.4 |  | `sh2` | value | 89 | 15th November 2026 |
| [Wobbly Wasp VII](94nop/wobbly-wasp-vii.red) | 2 | 102.0 |  | `isla/island-04` | pareto-age | 49 | 18th November 2026 |
| [Jagged Gecko III](94nop/jagged-gecko-iii.red) | 2 | 102.0 |  | `islsd/island-02` | pareto-sd | 29 | 18th November 2026 |
| [Furious Mantis XVI](94nop/furious-mantis-xvi.red) | 17 | 102.0 |  | `r2-prior` | value | 149 | 14th November 2026 |
| [Hollow Termite CXXX](94nop/hollow-termite-cxxx.red) | 5 | 101.9 |  | `an24`, `r-an24` | value | 2509 | 17th November 2026 |
| [Spiky Otter](94nop/spiky-otter.red) | 10 | 101.8 |  | `i55-46` | value | 39 | 17th November 2026 |
| [Cunning Beetle VI](94nop/cunning-beetle-vi.red) | 2 | 101.8 |  | `islv/island-07` | value | 59 | 18th November 2026 |
| [Quiet Griffin IV](94nop/quiet-griffin-iv.red) | 2 | 101.6 |  | `islsd/island-01` | pareto-sd | 69 | 18th November 2026 |
| [Ghostly Iguana](94nop/ghostly-iguana.red) | 2 | 101.3 |  | `islv/island-01` | value | 69 | 18th November 2026 |
| [Iron Yeti XV](94nop/iron-yeti-xv.red) | 2 | 101.1 |  | `islsda/island-02` | pareto-sd --difference ahead | 109 | 18th November 2026 |
| [Atomic Raccoon V](94nop/atomic-raccoon-v.red) | 3 | 101.0 |  | `islsda/island-03` | pareto-sd --difference ahead | 59 | 18th November 2026 |
| [Lone Hyena XXIV](94nop/lone-hyena-xxiv.red) | 3 | 100.8 |  | `i20-45` | value | 229 | 17th November 2026 |
| [Mad Raven V](94nop/mad-raven-v.red) | 2 | 100.6 |  | `islsd/island-06` | pareto-sd | 39 | 18th November 2026 |
| [Lone Yak CCCLXXVII](94nop/lone-yak-ccclxxvii.red) | 2 | 100.4 |  | `r-an21` | value | 2789 | 17th November 2026 |
| [Turbo Crab VI](94nop/turbo-crab-vi.red) | 3 | 100.3 |  | `isla/island-03` | pareto-age | 39 | 18th November 2026 |
| [Spinning Gremlin VIII](94nop/spinning-gremlin-viii.red) | 3 | 100.2 |  | `i20-42` | value | 69 | 17th November 2026 |
| [Undying Marmot VIII](94nop/undying-marmot-viii.red) | 2 | 100.2 |  | `isla/island-02` | pareto-age | 39 | 18th November 2026 |
| [Keen Pangolin VIII](94nop/keen-pangolin-viii.red) | 3 | 99.7 |  | `islv/island-02` | value | 89 | 18th November 2026 |
| [Mutant Sloth X](94nop/mutant-sloth-x.red) | 3 | 99.6 |  | `islv/island-04` | value | 89 | 18th November 2026 |
| [Wandering Yak CCCXVI](94nop/wandering-yak-cccxvi.red) | 2 | 99.4 |  | `an21` | value | 2529 | 17th November 2026 |
| [Crimson Mole XI](94nop/crimson-mole-xi.red) | 3 | 99.3 |  | `r2-value` | value | 129 | 14th November 2026 |
| [Stubborn Kobold II](94nop/stubborn-kobold-ii.red) | 3 | 99.0 |  | `islsda/island-01` | pareto-sd --difference ahead | 49 | 18th November 2026 |
| [Furious Tardigrade XVI](94nop/furious-tardigrade-xvi.red) | 6 | 98.8 |  | `m-rand` | value | 149 | 15th November 2026 |
| [Blazing Leech III](94nop/blazing-leech-iii.red) | 2 | 98.3 |  | `islsd/island-03` | pareto-sd | 29 | 18th November 2026 |
| [Electric Tardigrade V](94nop/electric-tardigrade-v.red) | 5 | 98.1 |  | `r2-ref` | value | 69 | 14th November 2026 |
| [Iron Tardigrade VIII](94nop/iron-tardigrade-viii.red) | 5 | 97.6 |  | `panel80` | value | 49 | 14th November 2026 |
| [Stubborn Kitten](94nop/stubborn-kitten.red) | 2 | 97.4 |  | `w1-an22` | value | 9 | 17th November 2026 |
| [Golden Salamander III](94nop/golden-salamander-iii.red) | 11 | 97.0 |  | `i20-52` | value | 39 | 17th November 2026 |
| [Zany Drone II](94nop/zany-drone-ii.red) | 15 | 96.8 |  | `pd81` | value | 2869 | 15th November 2026 |
| [Cosmic Basilisk II](94nop/cosmic-basilisk-ii.red) | 2 | 96.2 |  | `isl18` | value | 69 | 16th November 2026 |
| [Restless Condor XI](94nop/restless-condor-xi.red) | 5 | 96.2 |  | `islsd/island-04` | pareto-sd | 79 | 18th November 2026 |
| [Restless Salamander II](94nop/restless-salamander-ii.red) | 5 | 96.1 |  | `i20-53` | value | 449 | 17th November 2026 |
| [Toxic Lynx](94nop/toxic-lynx.red) | 5 | 95.7 |  | `i20-51` | value | 29 | 17th November 2026 |
| [Soggy Jackal IV](94nop/soggy-jackal-iv.red) | 60 | 95.6 |  | `st20c` | value | 1659 | 15th November 2026 |
| [Blazing Raccoon XIV](94nop/blazing-raccoon-xiv.red) | 3 | 94.7 |  | `cmp-p2-81` | pareto | 89 | 18th November 2026 |
| [Kinetic Werewolf XLII](94nop/kinetic-werewolf-xlii.red) | 22 | 94.6 |  | `cmp-p2-84` | pareto | 479 | 18th November 2026 |
| [Tiny Mammoth XIV](94nop/tiny-mammoth-xiv.red) | 3 | 93.9 |  | `cmp-p3-81` | pareto-age | 109 | 18th November 2026 |
| [Rowdy Yak XV](94nop/rowdy-yak-xv.red) | 33 | 93.7 |  | `isla/island-05` | pareto-age | 89 | 18th November 2026 |
| [Lucky Dragon III](94nop/lucky-dragon-iii.red) | 8 | 92.3 |  | `i20-49` | value | 39 | 17th November 2026 |
| [Recursive Tardigrade IV](94nop/recursive-tardigrade-iv.red) | 23 | 91.9 |  | `n1` | value | 39 | 15th November 2026 |
| [Neon Mole IV](94nop/neon-mole-iv.red) | 2 | 91.3 |  | `i55-52` | value | 29 | 17th November 2026 |
| [Rabid Owl III](94nop/rabid-owl-iii.red) | 5 | 90.2 |  | `i20-44` | value | 39 | 17th November 2026 |
| [Binary Pelican](94nop/binary-pelican.red) | 9 | 90.0 |  | `sp1` | value | 559 | 15th November 2026 |
| [Spicy Mammoth](94nop/spicy-mammoth.red) | 20 | 89.9 |  | `n2` | value | 199 | 15th November 2026 |
| [Rowdy Platypus II](94nop/rowdy-platypus-ii.red) | 6 | 89.7 |  | `islv/island-05` | value | 89 | 18th November 2026 |
| [Kinetic Tardigrade XVI](94nop/kinetic-tardigrade-xvi.red) | 17 | 89.3 |  | `m-rand-mix` | value | 149 | 15th November 2026 |
| [Ghostly Dingo IV](94nop/ghostly-dingo-iv.red) | 4 | 89.3 |  | `n0` | value | 239 | 15th November 2026 |
| [Lone Viper](94nop/lone-viper.red) | 4 | 89.3 |  | `s1-an24`, `s3-an24` | value | 9 | 17th November 2026 |
| [Lazy Pangolin](94nop/lazy-pangolin.red) | 12 | 89.0 |  | `cr1` | value | 69 | 15th November 2026 |
| [Vicious Hyena V](94nop/vicious-hyena-v.red) | 26 | 88.9 |  | `i55-48` | value | 29 | 17th November 2026 |
| [Rogue Lynx III](94nop/rogue-lynx-iii.red) | 5 | 88.8 |  | `i55-53` | value | 29 | 17th November 2026 |
| [Itchy Gremlin III](94nop/itchy-gremlin-iii.red) | 3 | 88.6 |  | `i55-49` | value | 39 | 17th November 2026 |
| [Wobbly Specter](94nop/wobbly-specter.red) | 10 | 88.3 |  | `islv/island-03` | value | 19 | 18th November 2026 |
| [Nervous Tardigrade XXXV](94nop/nervous-tardigrade-xxxv.red) | 13 | 88.2 |  | `s100` | value | 239 | 15th November 2026 |
| [Odd Tardigrade II](94nop/odd-tardigrade-ii.red) | 5 | 88.0 |  | `st20b` | value | 9 | 15th November 2026 |
| [Feisty Piranha II](94nop/feisty-piranha-ii.red) | 3 | 87.5 |  | `islsda/island-08` | pareto-sd --difference ahead | 99 | 18th November 2026 |
| [Eager Owl](94nop/eager-owl.red) | 19 | 87.3 |  | `i55-44` | value | 19 | 17th November 2026 |
| [Rusty Tardigrade XII](94nop/rusty-tardigrade-xii.red) | 54 | 86.6 |  | `r2-duel` | value | 89 | 14th November 2026 |
| [Wicked Locust IX](94nop/wicked-locust-ix.red) | 23 | 86.4 |  | `isla/island-08` | pareto-age | 59 | 18th November 2026 |
| [Jagged Mosquito VII](94nop/jagged-mosquito-vii.red) | 16 | 86.3 |  | `a`, `base` | value | 79 | 14th November 2026 |
| [Rogue Hyena](94nop/rogue-hyena.red) | 21 | 86.1 |  | `i20-56` | value | 39 | 17th November 2026 |
| [Nocturnal Gremlin III](94nop/nocturnal-gremlin-iii.red) | 3 | 86.0 |  | `i55-42` | value | 29 | 17th November 2026 |
| [Spinning Griffin XVII](94nop/spinning-griffin-xvii.red) | 9 | 85.6 |  | `isla/island-01` | pareto-age | 89 | 18th November 2026 |
| [Unstable Tardigrade III](94nop/unstable-tardigrade-iii.red) | 6 | 84.8 |  | `st20` | value | 19 | 15th November 2026 |
| [Jumpy Stingray II](94nop/jumpy-stingray-ii.red) | 11 | 83.7 |  | `i20-46` | value | 39 | 17th November 2026 |
| [Jolly Tardigrade III](94nop/jolly-tardigrade-iii.red) | 11 | 82.0 |  | `surv4` | value | 109 | 14th November 2026 |
| [Volatile Iguana VI](94nop/volatile-iguana-vi.red) | 25 | 81.9 |  | `cmp-p2-82` | pareto | 49 | 18th November 2026 |
| [Nimble Mantis](94nop/nimble-mantis.red) | 4 | 81.9 |  | `i55-54` | value | 19 | 17th November 2026 |
| [Sneaky Condor](94nop/sneaky-condor.red) | 5 | 81.3 |  | `islsda/island-04` | pareto-sd --difference ahead | 19 | 18th November 2026 |
| [Fearless Hornet IV](94nop/fearless-hornet-iv.red) | 8 | 81.2 |  | `i55-56` | value | 39 | 17th November 2026 |
| [Thorny Vampire II](94nop/thorny-vampire-ii.red) | 2 | 80.8 |  | `i55-47` | value | 29 | 17th November 2026 |
| [Nimble Mosquito](94nop/nimble-mosquito.red) | 23 | 80.3 |  | `alpha2` | value | 29 | 14th November 2026 |
| [Feral Basilisk](94nop/feral-basilisk.red) | 11 | 79.9 |  | `islv/island-08` | value | 49 | 18th November 2026 |
| [Vicious Gargoyle](94nop/vicious-gargoyle.red) | 4 | 77.3 |  | `i20-54` | value | 39 | 17th November 2026 |
| [Icy Wraith](94nop/icy-wraith.red) | 3 | 77.2 |  | `i20-48` | value | 39 | 17th November 2026 |
| [Jagged Kitten III](94nop/jagged-kitten-iii.red) | 6 | 76.9 |  | `islsda/island-07` | pareto-sd --difference ahead | 29 | 18th November 2026 |
| [Wiry Tardigrade XII](94nop/wiry-tardigrade-xii.red) | 6 | 75.5 |  | `s100-a2` | value | 79 | 15th November 2026 |
| [Patient Yak IV](94nop/patient-yak-iv.red) | 17 | 74.6 |  | `i20-50` | value | 29 | 17th November 2026 |
| [Rapid Platypus II](94nop/rapid-platypus-ii.red) | 12 | 74.0 |  | `i20-43` | value | 29 | 17th November 2026 |
| [Gilded Dodo](94nop/gilded-dodo.red) | 5 | 73.9 |  | `avg30` | value | 19 | 17th November 2026 |
| [Bitter Narwhal III](94nop/bitter-narwhal-iii.red) | 19 | 66.8 |  | `i20-47` | value | 39 | 17th November 2026 |
| [Bouncy Kitten III](94nop/bouncy-kitten-iii.red) | 15 | 66.8 |  | `i55-43` | value | 19 | 17th November 2026 |
| [Eternal Locust](94nop/eternal-locust.red) | 12 | 65.4 |  | `i55-50` | value | 29 | 17th November 2026 |
| [Soggy Yak II](94nop/soggy-yak-ii.red) | 3 |  | 110.3 | `isla/island-06` | pareto-age | 97 | 18th November 2026 |
| [Smug Yeti XI](94nop/smug-yeti-xi.red) | 2 |  | 105.8 | `islsda/island-02` | pareto-sd --difference ahead | 86 | 18th November 2026 |
| [Rogue Kitten IV](94nop/rogue-kitten-iv.red) | 2 |  | 106.2 | `islv/island-06` | value | 42 | 18th November 2026 |

## Tiny hill: `tiny/`, 118 warriors

Rules: `--size 800 --cycles 8000 --processes 800 --length 20 --distance 20`; opponents `warriors/koenigstuhl/tiny`.

| warrior | length | holdout | whole hill | run | push-off | batch | date |
|---|---|---|---|---|---|---|---|
| [Fearless Lobster MCCCXXXVII](tiny/fearless-lobster-mcccxxxvii.red) | 20 | 165.1 | 159.9 | `tsc5/island-11` | pareto-sd --clear 5 | 12889 | 19th November 2026 |
| [Clever Llama MCCXLV](tiny/clever-llama-mccxlv.red) | 8 | 162.7 |  | `tall2` | pareto-sd --clear 5 | 15289 | 19th November 2026 |
| [Neon Salamander CLIX](tiny/neon-salamander-clix.red) | 7 | 156.1 |  | `tsd/island-16` | pareto-sd | 1459 | 18th November 2026 |
| [Twisted Falcon LIV](tiny/twisted-falcon-liv.red) | 20 | 155.2 |  | `tsc10/island-16` | pareto-sd --clear 10 | 21739 | 19th November 2026 |
| [Overclocked Kitten CCCXXIII](tiny/overclocked-kitten-cccxxiii.red) | 20 | 155.1 |  | `tsd/island-14` | pareto-sd | 2439 | 18th November 2026 |
| [Lunar Squid CLXXXIX](tiny/lunar-squid-clxxxix.red) | 20 | 153.8 |  | `tv/island-10` | value | 4629 | 18th November 2026 |
| [Chaotic Lynx MDCXVI](tiny/chaotic-lynx-mdcxvi.red) | 17 | 153.0 |  | `tsc5/island-16` | pareto-sd --clear 5 | 17419 | 19th November 2026 |
| [Furious Stoat](tiny/furious-stoat.red) | 5 | 152.4 |  | `tsc10/island-01` | pareto-sd --clear 10 | 1499 | 18th November 2026 |
| [Salty Jackal XIV](tiny/salty-jackal-xiv.red) | 20 | 148.9 | 141.8 | `ta/island-03` | pareto-age | 269 | 18th November 2026 |
| [Mighty Dodo CCLIX](tiny/mighty-dodo-cclix.red) | 9 | 147.6 |  | `tall` | pareto-sd | 3209 | 18th November 2026 |
| [Bitter Mummy XXXVI](tiny/bitter-mummy-xxxvi.red) | 8 | 145.9 |  | `tp/island-16` | pareto | 359 | 18th November 2026 |
| [Quirky Eel](tiny/quirky-eel.red) | 10 | 145.2 |  | `tv/island-16` | value | 3479 | 18th November 2026 |
| [Lone Adder](tiny/lone-adder.red) | 4 | 137.6 |  | `ta/island-16` | pareto-age | 269 | 18th November 2026 |
| [Zesty Raptor XXVII](tiny/zesty-raptor-xxvii.red) | 18 | 129.8 | 121.9 | `tsda/island-16` | pareto-sd --difference ahead | 259 | 18th November 2026 |
| [Jittery Hornet XII](tiny/jittery-hornet-xii.red) | 16 | 129.4 |  | `tp/island-14` | pareto | 119 | 18th November 2026 |
| [Rabid Hedgehog IV](tiny/rabid-hedgehog-iv.red) | 5 | 127.4 |  | `ta/island-11` | pareto-age | 79 | 18th November 2026 |
| [Toxic Octopus II](tiny/toxic-octopus-ii.red) | 8 | 122.9 |  | `tsd/island-02` | pareto-sd | 79 | 18th November 2026 |
| [Lunar Kitten XLIII](tiny/lunar-kitten-xliii.red) | 20 | 116.5 |  | `tsda/island-11` | pareto-sd --difference ahead | 349 | 18th November 2026 |
| [Blazing Gibbon](tiny/blazing-gibbon.red) | 8 | 115.7 |  | `tsc10/island-04` | pareto-sd --clear 10 | 99 | 18th November 2026 |
| [Thorny Raptor II](tiny/thorny-raptor-ii.red) | 8 | 107.4 |  | `tp/island-15` | pareto | 89 | 18th November 2026 |
| [Stealthy Mammoth](tiny/stealthy-mammoth.red) | 20 | 106.6 |  | `tp/island-03` | pareto | 99 | 18th November 2026 |
| [Wobbly Sloth II](tiny/wobbly-sloth-ii.red) | 20 | 104.2 |  | `tsc5/island-12` | pareto-sd --clear 5 | 79 | 18th November 2026 |
| [Jagged Troll IV](tiny/jagged-troll-iv.red) | 20 | 103.9 |  | `ta/island-13` | pareto-age | 89 | 18th November 2026 |
| [Spinning Leech VI](tiny/spinning-leech-vi.red) | 3 | 101.1 |  | `ta/island-05` | pareto-age | 79 | 18th November 2026 |
| [Mad Hedgehog VI](tiny/mad-hedgehog-vi.red) | 4 | 101.0 |  | `tsc10/island-14` | pareto-sd --clear 10 | 49 | 18th November 2026 |
| [Blazing Kitten III](tiny/blazing-kitten-iii.red) | 2 | 100.4 |  | `tp/island-11` | pareto | 29 | 18th November 2026 |
| [Prickly Automaton II](tiny/prickly-automaton-ii.red) | 5 | 100.1 |  | `tp/island-05` | pareto | 49 | 18th November 2026 |
| [Yawning Virus](tiny/yawning-virus.red) | 8 | 99.9 |  | `tsc5/island-05` | pareto-sd --clear 5 | 99 | 18th November 2026 |
| [Whirling Jackal VI](tiny/whirling-jackal-vi.red) | 3 | 99.8 |  | `tsc5/island-15` | pareto-sd --clear 5 | 69 | 18th November 2026 |
| [Toxic Cobra](tiny/toxic-cobra.red) | 16 | 99.8 |  | `tsd/island-08` | pareto-sd | 99 | 18th November 2026 |
| [Electric Mammoth II](tiny/electric-mammoth-ii.red) | 3 | 99.3 |  | `tv/island-15` | value | 69 | 18th November 2026 |
| [Unstable Kestrel XIV](tiny/unstable-kestrel-xiv.red) | 3 | 99.0 |  | `tsda/island-10` | pareto-sd --difference ahead | 89 | 18th November 2026 |
| [Tiny Bison](tiny/tiny-bison.red) | 20 | 98.9 |  | `tsd/island-03` | pareto-sd | 89 | 18th November 2026 |
| [Spinning Kestrel VI](tiny/spinning-kestrel-vi.red) | 5 | 98.7 |  | `ta/island-10` | pareto-age | 99 | 18th November 2026 |
| [Neon Moose II](tiny/neon-moose-ii.red) | 20 | 98.6 |  | `tsda/island-07` | pareto-sd --difference ahead | 99 | 18th November 2026 |
| [Frantic Stoat](tiny/frantic-stoat.red) | 2 | 98.6 |  | `tv/island-03` | value | 59 | 18th November 2026 |
| [Itchy Worm V](tiny/itchy-worm-v.red) | 4 | 98.4 |  | `tsd/island-11` | pareto-sd | 29 | 18th November 2026 |
| [Nocturnal Heron III](tiny/nocturnal-heron-iii.red) | 3 | 98.2 |  | `tsd/island-04` | pareto-sd | 39 | 18th November 2026 |
| [Binary Ant III](tiny/binary-ant-iii.red) | 2 | 98.1 |  | `tsc10/island-03` | pareto-sd --clear 10 | 29 | 18th November 2026 |
| [Tricky Raven VI](tiny/tricky-raven-vi.red) | 3 | 98.1 |  | `tv/island-06` | value | 99 | 18th November 2026 |
| [Mellow Poltergeist III](tiny/mellow-poltergeist-iii.red) | 4 | 98.1 |  | `tv/island-11` | value | 69 | 18th November 2026 |
| [Feisty Shrew II](tiny/feisty-shrew-ii.red) | 4 | 97.8 |  | `tv/island-14` | value | 29 | 18th November 2026 |
| [Unstable Yeti III](tiny/unstable-yeti-iii.red) | 20 | 97.7 |  | `ta/island-01` | pareto-age | 99 | 18th November 2026 |
| [Mutant Mole V](tiny/mutant-mole-v.red) | 3 | 97.6 |  | `ta/island-06` | pareto-age | 49 | 18th November 2026 |
| [Pixelated Kestrel VI](tiny/pixelated-kestrel-vi.red) | 3 | 97.5 |  | `tp/island-10` | pareto | 69 | 18th November 2026 |
| [Fickle Virus](tiny/fickle-virus.red) | 17 | 97.1 |  | `tsc10/island-02` | pareto-sd --clear 10 | 19 | 18th November 2026 |
| [Scarlet Mammoth](tiny/scarlet-mammoth.red) | 20 | 97.1 |  | `tsda/island-14` | pareto-sd --difference ahead | 59 | 18th November 2026 |
| [Cosmic Virus XII](tiny/cosmic-virus-xii.red) | 3 | 97.0 |  | `ta/island-02` | pareto-age | 89 | 18th November 2026 |
| [Brazen Barnacle](tiny/brazen-barnacle.red) | 16 | 97.0 |  | `tp/island-08` | pareto | 59 | 18th November 2026 |
| [Sly Heron IV](tiny/sly-heron-iv.red) | 2 | 96.7 |  | `tsc5/island-04` | pareto-sd --clear 5 | 19 | 18th November 2026 |
| [Restless Termite IX](tiny/restless-termite-ix.red) | 3 | 96.6 |  | `ta/island-14` | pareto-age | 69 | 18th November 2026 |
| [Silver Koala VI](tiny/silver-koala-vi.red) | 20 | 96.6 |  | `ta/island-15` | pareto-age | 89 | 18th November 2026 |
| [Lazy Sloth III](tiny/lazy-sloth-iii.red) | 7 | 96.5 |  | `tsc5/island-07` | pareto-sd --clear 5 | 29 | 18th November 2026 |
| [Molten Heron V](tiny/molten-heron-v.red) | 4 | 96.4 |  | `tv/island-04` | value | 89 | 18th November 2026 |
| [Plucky Porcupine VI](tiny/plucky-porcupine-vi.red) | 2 | 96.3 |  | `tsd/island-05` | pareto-sd | 29 | 18th November 2026 |
| [Jumpy Kestrel XX](tiny/jumpy-kestrel-xx.red) | 20 | 96.1 |  | `tsd/island-10` | pareto-sd | 99 | 18th November 2026 |
| [Keen Jellyfish II](tiny/keen-jellyfish-ii.red) | 9 | 96.1 |  | `tsd/island-12` | pareto-sd | 19 | 18th November 2026 |
| [Daring Termite IX](tiny/daring-termite-ix.red) | 5 | 95.8 |  | `tsc10/island-09` | pareto-sd --clear 10 | 69 | 18th November 2026 |
| [Nervous Magpie V](tiny/nervous-magpie-v.red) | 4 | 95.7 |  | `tsc5/island-09` | pareto-sd --clear 5 | 79 | 18th November 2026 |
| [Plucky Minotaur](tiny/plucky-minotaur.red) | 5 | 95.5 |  | `tsda/island-02` | pareto-sd --difference ahead | 69 | 18th November 2026 |
| [Echoing Viper](tiny/echoing-viper.red) | 17 | 95.5 |  | `tsda/island-13` | pareto-sd --difference ahead | 79 | 18th November 2026 |
| [Eternal Troll III](tiny/eternal-troll-iii.red) | 5 | 95.4 |  | `tsc10/island-07` | pareto-sd --clear 10 | 39 | 18th November 2026 |
| [Sleepy Spider XI](tiny/sleepy-spider-xi.red) | 18 | 95.3 |  | `tsda/island-06` | pareto-sd --difference ahead | 89 | 18th November 2026 |
| [Stealthy Raccoon II](tiny/stealthy-raccoon-ii.red) | 3 | 95.2 |  | `tv/island-13` | value | 59 | 18th November 2026 |
| [Rowdy Koala](tiny/rowdy-koala.red) | 19 | 95.1 |  | `tsc10/island-05` | pareto-sd --clear 10 | 89 | 18th November 2026 |
| [Spinning Imp](tiny/spinning-imp.red) | 2 | 95.0 |  | `tsda/island-12` | pareto-sd --difference ahead | 19 | 18th November 2026 |
| [Feisty Penguin IV](tiny/feisty-penguin-iv.red) | 2 | 94.8 |  | `tv/island-09` | value | 39 | 18th November 2026 |
| [Fuzzy Troll XII](tiny/fuzzy-troll-xii.red) | 11 | 94.5 |  | `tsda/island-05` | pareto-sd --difference ahead | 59 | 18th November 2026 |
| [Vengeful Badger IX](tiny/vengeful-badger-ix.red) | 15 | 94.5 |  | `tv/island-07` | value | 59 | 18th November 2026 |
| [Bouncy Scorpion VII](tiny/bouncy-scorpion-vii.red) | 20 | 94.2 |  | `tp/island-09` | pareto | 79 | 18th November 2026 |
| [Shadowy Pixie](tiny/shadowy-pixie.red) | 20 | 94.0 |  | `tp/island-07` | pareto | 89 | 18th November 2026 |
| [Bouncy Pangolin II](tiny/bouncy-pangolin-ii.red) | 15 | 94.0 |  | `tsc10/island-08` | pareto-sd --clear 10 | 79 | 18th November 2026 |
| [Zesty Python III](tiny/zesty-python-iii.red) | 5 | 93.9 |  | `tsc5/island-02` | pareto-sd --clear 5 | 59 | 18th November 2026 |
| [Icy Lemur II](tiny/icy-lemur-ii.red) | 20 | 93.8 |  | `tsd/island-09` | pareto-sd | 29 | 18th November 2026 |
| [Fearless Kraken XIII](tiny/fearless-kraken-xiii.red) | 20 | 93.3 |  | `tsda/island-09` | pareto-sd --difference ahead | 99 | 18th November 2026 |
| [Wild Raptor VI](tiny/wild-raptor-vi.red) | 20 | 93.2 |  | `tsc10/island-12` | pareto-sd --clear 10 | 99 | 18th November 2026 |
| [Bouncy Hornet](tiny/bouncy-hornet.red) | 4 | 93.0 |  | `tsc5/island-13` | pareto-sd --clear 5 | 19 | 18th November 2026 |
| [Spicy Spider V](tiny/spicy-spider-v.red) | 14 | 92.7 |  | `tv/island-05` | value | 59 | 18th November 2026 |
| [Wandering Robot VII](tiny/wandering-robot-vii.red) | 7 | 92.5 |  | `tsd/island-15` | pareto-sd | 49 | 18th November 2026 |
| [Jumpy Yak IV](tiny/jumpy-yak-iv.red) | 20 | 92.4 |  | `ta/island-07` | pareto-age | 99 | 18th November 2026 |
| [Prickly Kestrel X](tiny/prickly-kestrel-x.red) | 20 | 92.4 |  | `tsc10/island-10` | pareto-sd --clear 10 | 99 | 18th November 2026 |
| [Patient Bumblebee IV](tiny/patient-bumblebee-iv.red) | 5 | 92.1 |  | `tsc10/island-06` | pareto-sd --clear 10 | 69 | 18th November 2026 |
| [Hasty Dragon XII](tiny/hasty-dragon-xii.red) | 20 | 91.8 |  | `ta/island-04` | pareto-age | 99 | 18th November 2026 |
| [Lunar Raptor III](tiny/lunar-raptor-iii.red) | 4 | 91.8 |  | `tsc5/island-10` | pareto-sd --clear 5 | 29 | 18th November 2026 |
| [Vengeful Badger IV](tiny/vengeful-badger-iv.red) | 4 | 91.7 |  | `tsd/island-07` | pareto-sd | 29 | 18th November 2026 |
| [Soggy Bison](tiny/soggy-bison.red) | 20 | 91.6 |  | `tsc10/island-11` | pareto-sd --clear 10 | 29 | 18th November 2026 |
| [Silver Kraken III](tiny/silver-kraken-iii.red) | 3 | 91.4 |  | `tv/island-01` | value | 49 | 18th November 2026 |
| [Nocturnal Sloth X](tiny/nocturnal-sloth-x.red) | 20 | 91.3 |  | `ta/island-12` | pareto-age | 89 | 18th November 2026 |
| [Zealous Panther II](tiny/zealous-panther-ii.red) | 20 | 91.2 |  | `tsc5/island-03` | pareto-sd --clear 5 | 99 | 18th November 2026 |
| [Quantum Tardigrade IX](tiny/quantum-tardigrade-ix.red) | 20 | 91.0 |  | `tp/island-02` | pareto | 89 | 18th November 2026 |
| [Lazy Spider](tiny/lazy-spider.red) | 6 | 90.8 |  | `tsd/island-13` | pareto-sd | 9 | 18th November 2026 |
| [Lazy Cyclops VIII](tiny/lazy-cyclops-viii.red) | 20 | 90.6 |  | `ta/island-09` | pareto-age | 79 | 18th November 2026 |
| [Blazing Imp V](tiny/blazing-imp-v.red) | 5 | 90.4 |  | `tp/island-12` | pareto | 29 | 18th November 2026 |
| [Undying Ant IX](tiny/undying-ant-ix.red) | 20 | 90.3 |  | `tsc5/island-08` | pareto-sd --clear 5 | 89 | 18th November 2026 |
| [Sly Mammoth II](tiny/sly-mammoth-ii.red) | 10 | 90.2 |  | `tsda/island-04` | pareto-sd --difference ahead | 19 | 18th November 2026 |
| [Jumpy Werewolf IV](tiny/jumpy-werewolf-iv.red) | 11 | 89.8 |  | `tsda/island-03` | pareto-sd --difference ahead | 59 | 18th November 2026 |
| [Fickle Python](tiny/fickle-python.red) | 5 | 89.7 |  | `tv/island-02` | value | 19 | 18th November 2026 |
| [Bitter Viper VI](tiny/bitter-viper-vi.red) | 17 | 89.0 |  | `tsc10/island-15` | pareto-sd --clear 10 | 69 | 18th November 2026 |
| [Vengeful Squid XI](tiny/vengeful-squid-xi.red) | 18 | 88.5 |  | `tv/island-12` | value | 99 | 18th November 2026 |
| [Rusty Magpie III](tiny/rusty-magpie-iii.red) | 20 | 87.9 |  | `tsd/island-06` | pareto-sd | 39 | 18th November 2026 |
| [Humble Raven V](tiny/humble-raven-v.red) | 20 | 87.2 |  | `tp/island-01` | pareto | 69 | 18th November 2026 |
| [Humble Spider](tiny/humble-spider.red) | 10 | 87.2 |  | `tsd/island-01` | pareto-sd | 39 | 18th November 2026 |
| [Humble Spider VIII](tiny/humble-spider-viii.red) | 20 | 86.7 |  | `tsc5/island-06` | pareto-sd --clear 5 | 99 | 18th November 2026 |
| [Mad Squid V](tiny/mad-squid-v.red) | 20 | 86.6 |  | `tsda/island-01` | pareto-sd --difference ahead | 39 | 18th November 2026 |
| [Jolly Shrew III](tiny/jolly-shrew-iii.red) | 20 | 86.1 |  | `tsc10/island-13` | pareto-sd --clear 10 | 89 | 18th November 2026 |
| [Restless Gecko](tiny/restless-gecko.red) | 9 | 85.8 |  | `tsc5/island-01` | pareto-sd --clear 5 | 19 | 18th November 2026 |
| [Hungry Salamander](tiny/hungry-salamander.red) | 16 | 84.7 |  | `tv/island-08` | value | 9 | 18th November 2026 |
| [Merry Lynx VIII](tiny/merry-lynx-viii.red) | 20 | 83.6 |  | `tsda/island-15` | pareto-sd --difference ahead | 99 | 18th November 2026 |
| [Restless Hydra VI](tiny/restless-hydra-vi.red) | 20 | 83.2 |  | `tp/island-13` | pareto | 99 | 18th November 2026 |
| [Quiet Yak X](tiny/quiet-yak-x.red) | 19 | 82.3 |  | `ta/island-08` | pareto-age | 89 | 18th November 2026 |
| [Eager Yak VII](tiny/eager-yak-vii.red) | 20 | 81.7 |  | `tsda/island-08` | pareto-sd --difference ahead | 39 | 18th November 2026 |
| [Zealous Eel II](tiny/zealous-eel-ii.red) | 20 | 81.0 |  | `tsc5/island-14` | pareto-sd --clear 5 | 39 | 18th November 2026 |
| [Hyper Heron VI](tiny/hyper-heron-vi.red) | 20 | 79.0 |  | `tp/island-04` | pareto | 79 | 18th November 2026 |
| [Mutant Mole IX](tiny/mutant-mole-ix.red) | 20 | 73.7 |  | `tp/island-06` | pareto | 89 | 18th November 2026 |
| [Crispy Mummy XXX](tiny/crispy-mummy-xxx.red) | 8 |  | 137.9 | `tp/island-16` | pareto | 296 | 18th November 2026 |
| [Silent Eel XIII](tiny/silent-eel-xiii.red) | 20 |  | 149.7 | `tsc10/island-16` | pareto-sd --clear 10 | 18670 | 19th November 2026 |
| [Vengeful Kitten CCXC](tiny/vengeful-kitten-ccxc.red) | 20 |  | 152.3 | `tsd/island-14` | pareto-sd | 2337 | 18th November 2026 |
| [Mellow Squid LVII](tiny/mellow-squid-lvii.red) | 20 |  | 146.6 | `tv/island-10` | value | 2574 | 18th November 2026 |
