;redcode
;name Tiny Bison
;author 42evolve
;strategy evolved, warrior 1552 of run seed 203, batch 89
;strategy 98.9 against 100 holdout warriors, 102.7 against the panel
;strategy from run tsd/island-03, 18th November 2026, --pushoff pareto-sd
        ORG     17
        DJN.F   #-3, {0
        MOV.I   $-9, <-8
        SPL.X   #97, {-6
        SPL.X   #-286, {16
        SPL.X   #-286, {-6
        MOV.I   $-9, <-8
        MUL.B   >-143, #96
        JMN.I   <-6, @-13
        MUL.AB  @3, $16
        SPL.X   #-286, {-3
        NOP.F   $-14, *13
        SPL.X   #-286, {-6
        SPL.X   #-290, {-3
        MOV.BA  $-9, <-223
        JMZ.BA  *1, >2
        SPL.X   #-286, {-6
        SUB.BA  >2, >2
        ADD.AB  #-3, $-15
        MOV.BA  #-8, $-15
        SPL.X   $-19, }12
