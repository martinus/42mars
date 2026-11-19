;redcode
;name Rowdy Koala
;author 42evolve
;strategy evolved, warrior 1492 of run seed 205, batch 89
;strategy 95.1 against 100 holdout warriors, 92.4 against the panel
;strategy from run tsc10/island-05, 18th November 2026, --pushoff pareto-sd --clear 10
        ORG     0
        SPL.I   #15, <13
        DJN.F   #0, {-12
        SPL.I   #1, <1
        SPL.I   #1, <1
        NOP.AB  @-178, >2
        SEQ.BA  *-107, #-15
        SPL.I   #1, <1
        MOV.I   {0, {0
        SPL.I   }5, <2
        SPL.BA  >394, #-9
        DAT.F   #8, >-6
        SUB.X   >71, @0
        DJN.F   #10, {12
        MOV.F   $5, <14
        SEQ.X   >-16, {1
        NOP.AB  >10, $-3
        SNE.AB  #9, }15
        MOV.I   {0, {-11
        DJN.F   #0, <-12
