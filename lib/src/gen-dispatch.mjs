#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Generates the dispatch of lib/src/mars.c: which instruction words (op
// byte | A mode << 8 | B mode << 11) have a case of their own, and how
// step() finds it. A case calls exec_ins() with a constant word, so that the
// compiler makes a copy of the instruction without mode or opcode branches.
// Words without a case run the generic code.
//
//   node lib/src/gen-dispatch.mjs [-o file]
//   node lib/src/gen-dispatch.mjs --rank [--top 512] <count files...>
//
//   (default)  dispatch.h from HOT below: what wasm/build.sh runs, written
//              to lib/src/dispatch.h
//   --rank     ranks instruction words by execution count. A count file has
//              lines "<word> <count>", as printed by bench-native.c built
//              with -DCOUNT_INS (bench/bench-native.mjs --count); every
//              file gets the same weight. Prints the entries of a HOT list.
//
// dispatch.h has three parts, each once for all words of HOT and once for
// the first 16 (M42_DISPATCH_16, which lib/src/platform.h defines for MSVC
// and for builds without optimization):
// - the index of every word: its position among the leaves of the trees
//   below, one index for all words without a case. mars.c keeps it in every
//   core cell next to the word (hot_index()), so that step() has it with
//   the cell.
// - the dispatch of step(), a tree of compares on that index for the first
//   NEAR words: a Huffman tree over the shares of HOT, so the most executed
//   words are 4 to 5 compares from the root (6 on average over the shares),
//   and no leaf has to test for equality, because every index is a leaf.
//   One leaf stands for all other words.
// - the dispatch of exec_more(), the tree behind that leaf: the cases of
//   the words after the first NEAR, and the generic code for the rest.
//
// The output is deterministic: wasm/build.sh regenerates dispatch.h
// and the committed file must not change.

import { readFileSync, writeFileSync } from 'node:fs';

const OPS = ['mov', 'add', 'sub', 'mul', 'div', 'mod', 'jmz', 'jmn', 'djn', 'cmp', 'slt', 'spl', 'dat', 'jmp', 'seq', 'sne', 'nop', 'ldp', 'stp'];
const MODS = ['a', 'b', 'ab', 'ba', 'f', 'x', 'i'];
const MODES = '#$@<>*{}';

// The most executed instruction words with their share of all executed
// instructions in percent: 13 mixes with early ties, each weighted equally
// (--rank). Nine are hills of warriors/koenigstuhl, random pairs with the
// hill's settings (94nop, pspace-top50, 88, odd, lp, tiny, nano, x, icws),
// four come from the corpus of docs/performance-log.md (t20, t80, 400
// corpus pairs, the bench); the log's sixth round has the commands. The
// '94 hills execute far more different words than the '88 ones: 64 words
// are 97% of the instructions of an '88 mix and 84% of 94nop's.
//
// The first NEAR words have their case in the instruction loops, the others
// in one function behind them (exec_more() in mars.c), and what is left,
// 0.2%, runs the generic code there. 256 cases in the loops were faster than
// 128, 384 and 512 (clang slows down above 256), and 256 more behind them
// add 1 to 4% on the '94 hills.
const NEAR = 256;
const HOT = [
  ['mov.i $ $', 6.1913], ['spl.b $ <', 6.1093], ['spl.b $ $', 5.4067], ['dat.f $ $', 5.1253], ['mov.i $ <', 5.0199],
  ['jmp.b $ $', 4.6425], ['mov.i # $', 4.2572], ['spl.b # $', 3.6746], ['jmp.b $ <', 2.8136], ['mov.i # }', 2.3543],
  ['mov.i $ >', 2.3116], ['add.ab # $', 2.1584], ['dat.f < <', 1.9699], ['mov.i # *', 1.7235], ['mov.i $ @', 1.5090],
  ['dat.f # #', 1.4919], ['djn.b $ <', 1.4699], ['spl.b # #', 1.3553], ['djn.b $ $', 1.3302], ['mov.i < <', 1.3264],
  ['mov.i @ >', 1.3048], ['spl.b # <', 1.2406], ['mov.i @ <', 1.1960], ['djn.b $ #', 1.1264], ['djn.f $ >', 1.0913],
  ['jmn.b $ $', 1.0478], ['mov.i * >', 0.9857], ['add.f $ $', 0.9642], ['mov.i # <', 0.9093], ['spl.b @ $', 0.9047],
  ['mov.i } >', 0.8025], ['spl.b # {', 0.7941], ['djn.f $ {', 0.6660], ['mov.i $ }', 0.6357], ['jmp.b # $', 0.6172],
  ['mov.i < {', 0.5962], ['djn.b $ {', 0.5446], ['djn.f $ <', 0.5308], ['spl.b $ #', 0.5195], ['cmp.i $ $', 0.5122],
  ['spl.b # >', 0.4975], ['sub.f $ $', 0.4876], ['spl.b # }', 0.4840], ['mov.ab # $', 0.4825], ['jmz.b $ $', 0.4729],
  ['jmp.b $ #', 0.4726], ['dat.f < #', 0.4475], ['jmp.b # #', 0.4285], ['sub.ab # $', 0.4254], ['djn.i # {', 0.4245],
  ['mov.i # {', 0.4114], ['spl.b @ <', 0.3871], ['jmz.b $ @', 0.3725], ['mov.i { <', 0.3127], ['mov.i } }', 0.2919],
  ['jmz.f $ @', 0.2872], ['cmp.i < <', 0.2847], ['djn.f $ }', 0.2739], ['mov.i { {', 0.2610], ['jmp.b @ $', 0.2581],
  ['mov.i > {', 0.2573], ['jmp.b # >', 0.2534], ['mov.i $ {', 0.2444], ['djn.f # <', 0.2437], ['add.ab # #', 0.2420],
  ['dat.f < $', 0.2338], ['jmp.b # <', 0.2256], ['mov.i < $', 0.2229], ['dat.f > $', 0.2202], ['slt.ab # $', 0.2142],
  ['spl.b $ >', 0.2126], ['jmn.b $ @', 0.2066], ['dat.f > >', 0.2013], ['spl.b @ >', 0.2004], ['jmz.f $ <', 0.1899],
  ['mov.i > }', 0.1898], ['jmp.b $ >', 0.1689], ['mov.i # >', 0.1623], ['jmp.b # {', 0.1612], ['mov.i * <', 0.1434],
  ['add.ab # @', 0.1416], ['add.f $ @', 0.1406], ['dat.f < >', 0.1372], ['mov.i @ }', 0.1344],
  ['add.ab { }', 0.1340], ['spl.b @ }', 0.1255], ['mov.i $ *', 0.1197], ['spl.b $ {', 0.1145], ['dat.f # $', 0.1126],
  ['mov.i > $', 0.1112], ['cmp.ab # $', 0.1098], ['djn.a $ $', 0.1080], ['add.a # $', 0.1056],
  ['mov.ab # @', 0.1050], ['mov.i * }', 0.1043], ['jmz.b $ <', 0.1042], ['mov.ab # <', 0.1018],
  ['mov.i @ {', 0.1014], ['mov.ab # #', 0.0974], ['mov.i @ @', 0.0951], ['djn.f $ $', 0.0944], ['jmp.b $ }', 0.0935],
  ['cmp.ab # <', 0.0920], ['spl.i # >', 0.0845], ['sub.f $ @', 0.0827], ['spl.b @ #', 0.0825], ['jmz.f $ *', 0.0809],
  ['mov.i } {', 0.0799], ['spl.a # $', 0.0789], ['djn.a $ <', 0.0781], ['sne.i $ $', 0.0751], ['jmn.b @ *', 0.0747],
  ['jmp.b $ {', 0.0729], ['mov.i > <', 0.0722], ['stp.ab # #', 0.0720], ['mov.i { $', 0.0695], ['spl.a # >', 0.0689],
  ['jmp.a $ }', 0.0680], ['mov.i > >', 0.0676], ['spl.b @ {', 0.0652], ['djn.b $ @', 0.0609], ['spl.i # #', 0.0602],
  ['jmp.b @ >', 0.0597], ['add.f { }', 0.0592], ['jmp.a # $', 0.0590], ['djn.b $ >', 0.0585], ['mov.i } <', 0.0583],
  ['dat.f } >', 0.0555], ['jmp.b { }', 0.0551], ['spl.a # }', 0.0545], ['jmz.b @ $', 0.0544], ['jmz.f $ >', 0.0528],
  ['sub.x # $', 0.0515], ['jmz.b # @', 0.0493], ['dat.f $ }', 0.0492], ['mov.i < }', 0.0487], ['djn.f # {', 0.0486],
  ['jmn.f $ @', 0.0479], ['cmp.a $ $', 0.0478], ['mov.i * {', 0.0473], ['spl.ba # >', 0.0464], ['jmn.f $ >', 0.0460],
  ['slt.b $ #', 0.0453], ['sne.i > >', 0.0433], ['djn.b # #', 0.0430], ['spl.b $ }', 0.0423], ['jmn.b $ <', 0.0423],
  ['spl.i # }', 0.0403], ['sub.f @ <', 0.0400], ['spl.f # >', 0.0397], ['jmz.f $ $', 0.0397], ['stp.ab > #', 0.0382],
  ['spl.a # #', 0.0381], ['spl.ab # $', 0.0370], ['spl.ba # }', 0.0368], ['sne.ab # $', 0.0357],
  ['spl.a # <', 0.0351], ['spl.b < >', 0.0349], ['dat.f } }', 0.0340], ['mov.i @ $', 0.0340], ['seq.i * @', 0.0332],
  ['jmz.f $ }', 0.0329], ['jmn.b $ #', 0.0328], ['spl.f $ >', 0.0314], ['djn.f @ <', 0.0310], ['djn.x $ {', 0.0309],
  ['spl.f # $', 0.0301], ['jmz.b $ *', 0.0299], ['spl.ba # <', 0.0290], ['jmz.a @ $', 0.0289], ['dat.f { >', 0.0287],
  ['djn.x $ <', 0.0285], ['spl.x # >', 0.0277], ['cmp.x $ $', 0.0271], ['spl.ab # }', 0.0262], ['seq.i $ $', 0.0258],
  ['djn.f < >', 0.0258], ['jmz.b $ #', 0.0255], ['mov.ab # *', 0.0241], ['spl.ba # {', 0.0240],
  ['djn.i $ <', 0.0239], ['dat.f < {', 0.0238], ['spl.i # <', 0.0237], ['mov.i { }', 0.0236], ['cmp.i @ @', 0.0233],
  ['djn.a # <', 0.0233], ['spl.b # *', 0.0231], ['mov.i < >', 0.0230], ['spl.ab # >', 0.0229],
  ['djn.ba # <', 0.0220], ['slt.b $ $', 0.0218], ['spl.x # <', 0.0216], ['jmz.f $ {', 0.0207], ['dat.f > <', 0.0201],
  ['jmz.a $ *', 0.0198], ['add.x $ $', 0.0192], ['djn.i $ $', 0.0190], ['add.f @ @', 0.0183], ['djn.i $ {', 0.0181],
  ['jmp.b @ <', 0.0180], ['mov.i } $', 0.0179], ['spl.f # }', 0.0179], ['add.a # @', 0.0178], ['mov.i { >', 0.0170],
  ['spl.ab # @', 0.0170], ['djn.f * <', 0.0168], ['jmz.b # {', 0.0166], ['slt.ab # @', 0.0159],
  ['dat.f $ >', 0.0156], ['add.ba # #', 0.0156], ['dat.f > {', 0.0155], ['djn.f @ {', 0.0155], ['dat.f { $', 0.0154],
  ['spl.a $ {', 0.0154], ['dat.f # <', 0.0153], ['spl.f # #', 0.0153], ['sub.x * @', 0.0151], ['djn.i $ }', 0.0150],
  ['spl.a $ $', 0.0148], ['jmn.b $ *', 0.0142], ['mov.i } *', 0.0141], ['sub.f # $', 0.0140], ['djn.a $ >', 0.0139],
  ['spl.f # <', 0.0139], ['jmp.f $ >', 0.0135], ['spl.b { }', 0.0134], ['spl.x # {', 0.0133], ['add.x # $', 0.0132],
  ['djn.f # $', 0.0131], ['jmp.a $ $', 0.0130], ['mov.b } #', 0.0130], ['spl.f $ @', 0.0129], ['dat.f { <', 0.0128],
  ['jmn.a $ *', 0.0127], ['add.f # $', 0.0126], ['jmp.a $ {', 0.0124], ['mov.i * @', 0.0122], ['djn.x $ }', 0.0121],
  ['jmz.a @ <', 0.0121], ['dat.f # }', 0.0120], ['spl.i # @', 0.0119], ['dat.f $ <', 0.0119], ['djn.f $ *', 0.0119],
  ['djn.f { }', 0.0118], ['cmp.i $ @', 0.0117], ['spl.i # {', 0.0117], ['div.ba # #', 0.0116], ['add.f < <', 0.0111],
  ['jmp.ba # >', 0.0110], ['div.x # #', 0.0108], ['spl.a # *', 0.0107], ['spl.a # @', 0.0105], ['add.b $ $', 0.0104],
  ['jmp.b $ @', 0.0103], ['jmz.f @ {', 0.0101], ['jmz.a $ @', 0.0101], ['sne.x $ $', 0.0101], ['jmp.b @ #', 0.0100],
  ['spl.x # }', 0.0100], ['slt.b @ #', 0.0099], ['sub.x $ $', 0.0098], ['add.ba { {', 0.0097], ['mov.i * $', 0.0096],
  ['cmp.i @ $', 0.0095], ['spl.ab # <', 0.0094], ['spl.i # *', 0.0094], ['slt.a # $', 0.0094], ['spl.b < <', 0.0093],
  ['mov.i < @', 0.0093], ['djn.b @ <', 0.0093], ['dat.f > }', 0.0091], ['add.f < >', 0.0091], ['sne.f $ $', 0.0091],
  ['spl.f # {', 0.0090], ['spl.b { >', 0.0089], ['sub.ab # @', 0.0089], ['spl.a # {', 0.0089], ['add.x # *', 0.0087],
  ['sne.i * @', 0.0086], ['dat.f $ {', 0.0085], ['dat.ab { $', 0.0085], ['jmn.a $ @', 0.0084],
  ['seq.ab * #', 0.0084], ['sne.ab { #', 0.0084], ['jmp.i $ >', 0.0082], ['djn.x $ $', 0.0082],
  ['jmz.a $ <', 0.0081], ['mov.f $ $', 0.0081], ['mov.i } @', 0.0080], ['spl.b # @', 0.0079], ['spl.x # #', 0.0079],
  ['spl.b * <', 0.0078], ['mov.a # $', 0.0078], ['djn.i # <', 0.0077], ['djn.ba $ >', 0.0077], ['sne.x * @', 0.0077],
  ['spl.ab # {', 0.0076], ['jmn.f $ <', 0.0076], ['sub.ab # #', 0.0075], ['jmz.a $ $', 0.0074],
  ['spl.i $ <', 0.0074], ['djn.ba # #', 0.0073], ['seq.f * @', 0.0072], ['spl.a @ $', 0.0070], ['dat.f $ #', 0.0070],
  ['spl.b < $', 0.0070], ['mov.ab # >', 0.0070], ['mov.i # @', 0.0069], ['sne.i < <', 0.0068], ['djn.f @ >', 0.0068],
  ['sne.x * >', 0.0068], ['jmz.b @ #', 0.0068], ['jmz.f @ @', 0.0066], ['dat.f > #', 0.0066], ['djn.a # #', 0.0066],
  ['djn.i $ @', 0.0065], ['jmp.ba # <', 0.0065], ['sne.i { <', 0.0064], ['cmp.i $ <', 0.0063], ['jmz.i @ *', 0.0063],
  ['jmp.f { }', 0.0063], ['jmp.b @ }', 0.0062], ['spl.i @ {', 0.0061], ['djn.f * >', 0.0061], ['stp.ab # >', 0.0061],
  ['jmz.b # <', 0.0060], ['spl.i @ >', 0.0060], ['nop.f > >', 0.0059], ['sne.b $ $', 0.0059], ['mov.f $ >', 0.0058],
  ['spl.ab $ <', 0.0057], ['mul.f # $', 0.0057], ['djn.ab $ {', 0.0057], ['spl.i @ <', 0.0056],
  ['djn.a $ }', 0.0055], ['djn.b $ }', 0.0055], ['spl.ba $ >', 0.0054], ['djn.a { }', 0.0054], ['jmp.i $ }', 0.0053],
  ['jmp.a @ >', 0.0053], ['nop.f < <', 0.0051], ['dat.a > >', 0.0051], ['dat.f } <', 0.0050], ['sne.i * <', 0.0050],
  ['dat.b { }', 0.0050], ['spl.a $ }', 0.0050], ['mov.b $ $', 0.0049], ['spl.f @ <', 0.0049], ['djn.i @ }', 0.0049],
  ['sne.i * >', 0.0049], ['dat.f < }', 0.0048], ['djn.f $ @', 0.0048], ['spl.f $ $', 0.0048], ['cmp.ab # @', 0.0048],
  ['div.ab # #', 0.0047], ['add.i $ $', 0.0047], ['djn.b { }', 0.0047], ['slt.b < {', 0.0046], ['add.b $ #', 0.0045],
  ['mov.i > *', 0.0045], ['dat.x # #', 0.0045], ['add.f $ <', 0.0044], ['spl.i # $', 0.0044], ['sub.f @ $', 0.0043],
  ['nop.f < >', 0.0043], ['mov.b $ #', 0.0043], ['jmn.b > $', 0.0043], ['div.a # >', 0.0042], ['mov.i { @', 0.0041],
  ['mov.i > @', 0.0041], ['spl.ba # $', 0.0041], ['add.x # {', 0.0040], ['spl.i $ #', 0.0039], ['sub.b # $', 0.0039],
  ['mov.f @ <', 0.0039], ['nop.f { >', 0.0039], ['seq.i $ @', 0.0039], ['jmn.a $ $', 0.0037], ['sne.ab $ $', 0.0037],
  ['spl.b } {', 0.0037], ['spl.b > <', 0.0036], ['spl.ba # *', 0.0036], ['mov.i @ *', 0.0035], ['jmp.f # <', 0.0035],
  ['jmp.b @ {', 0.0034], ['seq.f $ *', 0.0034], ['mul.ab # @', 0.0034], ['mul.f * @', 0.0033], ['djn.f * {', 0.0033],
  ['stp.a @ $', 0.0033], ['add.ab $ #', 0.0033], ['jmn.ba $ *', 0.0033], ['spl.b > $', 0.0033],
  ['jmp.a $ <', 0.0032], ['jmz.f @ *', 0.0032], ['sne.x @ *', 0.0032], ['jmz.b $ {', 0.0031], ['jmp.b > $', 0.0031],
  ['add.b # $', 0.0031], ['add.ba # {', 0.0031], ['jmn.ab $ #', 0.0030], ['spl.ab $ }', 0.0030],
  ['jmz.a $ {', 0.0030], ['jmz.ba # {', 0.0030], ['djn.i $ >', 0.0029], ['dat.f { {', 0.0029], ['jmp.b < <', 0.0029],
  ['add.ab $ $', 0.0029], ['jmz.b @ @', 0.0028], ['dat.f # >', 0.0028], ['add.f < $', 0.0028], ['jmn.f $ }', 0.0028],
  ['add.x # #', 0.0027], ['spl.ba @ >', 0.0027], ['spl.x # *', 0.0027], ['sub.ab $ $', 0.0027],
  ['mov.x { {', 0.0026], ['add.i # }', 0.0026], ['dat.ab < <', 0.0026], ['spl.b > }', 0.0026], ['cmp.i @ <', 0.0026],
  ['dat.b < {', 0.0026], ['jmz.f # {', 0.0025], ['mov.ab # }', 0.0025], ['jmn.a $ {', 0.0025], ['seq.i } }', 0.0024],
  ['spl.i $ *', 0.0024], ['dat.b $ $', 0.0024], ['jmp.b > }', 0.0024], ['jmp.a @ $', 0.0024], ['seq.i > $', 0.0024],
  ['sne.ab # @', 0.0023], ['seq.ab # @', 0.0023], ['spl.x > >', 0.0023], ['jmz.b * #', 0.0023],
  ['jmz.i # >', 0.0023], ['jmp.ba $ >', 0.0023], ['jmp.b * <', 0.0023], ['sub.ba $ @', 0.0022],
  ['sne.i $ {', 0.0022], ['spl.ab < <', 0.0022], ['add.x # >', 0.0022], ['jmp.b # *', 0.0022], ['djn.i { $', 0.0021],
  ['dat.i > >', 0.0021], ['sub.x # @', 0.0021], ['dat.f } $', 0.0021], ['seq.i } $', 0.0021], ['dat.f $ *', 0.0020],
  ['djn.ab < }', 0.0020], ['mov.f $ @', 0.0020], ['sub.ab { }', 0.0020], ['add.f # <', 0.0020],
  ['add.a # *', 0.0020], ['jmn.f $ $', 0.0020], ['sne.x > >', 0.0020], ['seq.f @ #', 0.0019], ['djn.b @ #', 0.0019],
  ['slt.b $ @', 0.0019], ['djn.f @ }', 0.0019], ['div.x > >', 0.0019], ['sub.f # @', 0.0019], ['djn.f { {', 0.0019],
  ['djn.ab < $', 0.0019], ['spl.ba > <', 0.0018], ['jmn.a @ $', 0.0018], ['spl.b < }', 0.0018],
  ['jmp.b } }', 0.0018], ['sne.f * @', 0.0018], ['spl.b { <', 0.0018], ['jmp.i * <', 0.0018], ['add.i $ {', 0.0018],
  ['sub.ab < >', 0.0017], ['dat.b $ >', 0.0017], ['jmz.b $ >', 0.0017], ['jmn.f @ {', 0.0017], ['add.f @ $', 0.0017],
  ['mod.ab # $', 0.0017], ['djn.a @ *', 0.0017], ['spl.x # @', 0.0017], ['mul.x # #', 0.0017], ['dat.f # {', 0.0017],
  ['mul.i } {', 0.0017], ['mov.ab @ @', 0.0017], ['mov.x # <', 0.0017], ['seq.i * >', 0.0017], ['cmp.i { <', 0.0016],
  ['djn.b * #', 0.0016], ['jmz.b $ }', 0.0016], ['dat.b { >', 0.0016], ['spl.i } $', 0.0016], ['mov.f # >', 0.0016],
  ['jmp.f $ <', 0.0015], ['djn.x @ $', 0.0015], ['spl.ba { >', 0.0015], ['mov.i { *', 0.0015], ['add.a $ $', 0.0015],
  ['spl.x } {', 0.0015], ['spl.ba @ {', 0.0015], ['spl.ba # @', 0.0015], ['sub.f < <', 0.0015],
  ['spl.i $ @', 0.0015], ['div.b } $', 0.0015], ['jmn.f # <', 0.0015], ['sne.a $ $', 0.0015], ['djn.ab $ #', 0.0015],
  ['add.f * @', 0.0015], ['jmp.x $ <', 0.0015], ['mov.ab $ $', 0.0015], ['djn.i < >', 0.0015], ['jmp.x $ {', 0.0014],
  ['sne.i $ >', 0.0014],
];

const word = (op, mod, am, bm) => (op << 3) | mod | (am << 8) | (bm << 11);
const name = (w) => `${OPS[(w & 0xff) >> 3]}.${MODS[w & 7]} ${MODES[(w >> 8) & 7]} ${MODES[w >> 11]}`;

function parse(text) {
  const m = /^([a-z]+)\.([a-z]+) (\S) (\S)$/.exec(text);
  const op = m && OPS.indexOf(m[1]);
  const mod = m && MODS.indexOf(m[2]);
  const am = m && MODES.indexOf(m[3]);
  const bm = m && MODES.indexOf(m[4]);
  if (!m || op < 0 || mod < 0 || am < 0 || bm < 0) throw new Error(`bad HOT entry '${text}'`);
  return word(op, mod, am, bm);
}

const argv = process.argv.slice(2);
const take = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv.splice(i, 1).length : 0; };
const value = (flag, dflt) => { const i = argv.indexOf(flag); return i >= 0 ? argv.splice(i, 2)[1] : dflt; };

if (take('--rank')) {
  const top = Number(value('--top', 512));
  const weight = new Map();
  for (const file of argv) {
    const rows = readFileSync(file, 'utf8').trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number));
    const total = rows.reduce((s, r) => s + r[1], 0);
    for (const [w, c] of rows) weight.set(w, (weight.get(w) ?? 0) + c / total / argv.length);
  }
  const ranked = [...weight].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  let sum = 0;
  for (const [w, x] of ranked.slice(0, top)) {
    sum += x;
    console.log(`['${name(w)}', ${(100 * x).toFixed(4)}], // cumulative ${(100 * sum).toFixed(2)}%`);
  }
  process.exit(0);
}
for (const gone of ['--full', '--partial']) {
  if (take(gone)) {
    console.error(`${gone} is gone: a case for every word, or for every opcode, modifier and B mode, was much slower (docs/performance-log.md, second round)`);
    process.exit(2);
  }
}
const out = value('-o', null);
if (argv.length) {
  console.error(`gen-dispatch.mjs: unknown argument ${argv[0]} (options: -o <file>, --rank [--top n] <count files>)`);
  process.exit(2);
}

// The three parts for the first `count` words of HOT, as lines: the first
// `near` words have their case in step(), the others in exec_more().
function parts(count, near) {
  const seen = new Set();
  const leaves = HOT.slice(0, count).map(([text, share], age) => {
    const w = parse(text);
    if (seen.has(w)) throw new Error(`duplicate HOT entry '${text}'`);
    if (!(share > 0)) throw new Error(`HOT entry '${text}' needs a share above 0`);
    seen.add(w);
    return { w, text, p: share, age };
  });
  const rest = 100 - leaves.reduce((s, l) => s + l.p, 0);
  if (!(rest > 0)) throw new Error('the shares of HOT add up to 100 or more');
  leaves.push({ w: -1, text: 'every other word', p: rest, age: count });

  // Huffman: join the two least likely nodes until one is left. Ties go by
  // age, so the result does not depend on the sort.
  let age = leaves.length;
  const huffman = (list) => {
    let nodes = [...list];
    while (nodes.length > 1) {
      nodes.sort((a, b) => a.p - b.p || a.age - b.age);
      const [a, b] = nodes;
      nodes = [...nodes.slice(2), { low: b, high: a, p: a.p + b.p, age: age++ }]; // the likelier side gets the lower indices
    }
    return nodes[0];
  };
  // The tree of exec_more() is one leaf of the tree of step().
  const far = huffman(leaves.slice(near));
  const more = { more: far, p: far.p, age: age++ };
  const root = huffman([...leaves.slice(0, near), more]);
  // Leaves numbered from left to right: every subtree is a range of
  // indices, `first` is its lowest (a leaf's own).
  let next = 0;
  const number = (t) => {
    if (t.more) { number(t.more); t.first = t.more.first; }
    else if (t.low) { number(t.low); number(t.high); t.first = t.low.first; }
    else t.first = next++;
  };
  number(root);

  const index = ['switch (ins) {'];
  for (const l of leaves) index.push(l.w < 0 ? `  default: return ${l.first}; // ${l.text}` : `  case ${l.w}: return ${l.first}; // ${l.text}`);
  index.push('}');

  const emit = (t, indent, lines) => {
    if (t.more) lines.push(`${indent}return EXEC_MORE(); // the words of exec_more()`);
    else if (!t.low) lines.push(`${indent}return ${t.w < 0 ? 'EXEC_OTHER()' : `EXEC(${t.w})`}; // ${t.text}`);
    else {
      lines.push(`${indent}if (hot < ${t.high.first}) {`);
      emit(t.low, indent + '  ', lines);
      lines.push(`${indent}} else {`);
      emit(t.high, indent + '  ', lines);
      lines.push(`${indent}}`);
    }
    return lines;
  };
  return { index, tree: emit(root, '', []), more: emit(far, '', []) };
}

const all = parts(HOT.length, NEAR);
const few = parts(16, 16);
const text = [
  '// SPDX-License-Identifier: MIT',
  '// Copyright (c) 2026 Martin Leitner-Ankerl',
  '// Generated by lib/src/gen-dispatch.mjs; do not edit.',
  '// mars.c includes it three times: with M42_DISPATCH_INDEX it is the body',
  '// of hot_index(), the index of an instruction word; with M42_DISPATCH_MORE',
  '// the dispatch of exec_more(); without both the dispatch of step().',
  '#if defined(M42_DISPATCH_INDEX) && !defined(M42_DISPATCH_16)',
  ...all.index,
  '#elif defined(M42_DISPATCH_INDEX)',
  ...few.index,
  '#elif defined(M42_DISPATCH_MORE) && !defined(M42_DISPATCH_16)',
  ...all.more,
  '#elif defined(M42_DISPATCH_MORE)',
  ...few.more,
  '#elif !defined(M42_DISPATCH_16)',
  ...all.tree,
  '#else',
  ...few.tree,
  '#endif',
].join('\n') + '\n';
if (out) writeFileSync(out, text);
else process.stdout.write(text);
