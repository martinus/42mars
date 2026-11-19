;redcode
;name Wild Raptor VI
;author 42evolve
;strategy evolved, warrior 1667 of run seed 212, batch 99
;strategy 93.2 against 100 holdout warriors, 89.0 against the panel
;strategy from run tsc10/island-12, 18th November 2026, --pushoff pareto-sd --clear 10
        ORG     1
        JMN.F   {-6, }17
        SPL.A   #30, {299
        DJN.X   #-13, {-12
        SPL.B   }-15, #-10
        SPL.X   #15, {-3
        NOP.A   @-116, $9
        SPL.BA  $0, $14
        SPL.X   #15, {-6
        SUB.A   #9, @6
        MOV.I   {10, <-346
        SPL.B   }-1, @0
        JMZ.AB  #1, @1
        JMZ.AB  #1, @1
        SUB.I   *247, >-237
        MOV.I   *247, >6
        SPL.B   }392, #-14
        SLT.X   }-15, *0
        SUB.AB  <284, >-2
        JMZ.F   #-7, @9
        MUL.F   $-14, {-188
