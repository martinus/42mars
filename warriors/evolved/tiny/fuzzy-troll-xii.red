;redcode
;name Fuzzy Troll XII
;author 42evolve
;strategy evolved, warrior 1078 of run seed 205, batch 59
;strategy 94.5 against 100 holdout warriors, 83.0 against the panel
;strategy from run tsda/island-05, 18th November 2026, --pushoff pareto-sd --difference ahead
        ORG     1
        SLT.B   {-1, $-11
        SPL.BA  #-100, $8
        DJN.I   #1, {0
        DIV.AB  @-9, @2
        JMP.BA  }4, *-103
        JMP.AB  $-104, $340
        ADD.BA  #396, @1
        ADD.X   $0, >-7
        JMP.X   $-104, $340
        MOD.X   #-6, *1
        SEQ.AB  {-10, $-4
