;redcode
;name Hasty Dragon XII
;author 42evolve
;strategy evolved, warrior 1722 of run seed 204, batch 99
;strategy 91.8 against 100 holdout warriors, 83.3 against the panel
;strategy from run ta/island-04, 18th November 2026, --pushoff pareto-age
        ORG     0
        SPL.F   #0, *19
        DJN.X   #-12, <-11
        SPL.F   #340, #204
        MUL.B   }237, <-362
        MUL.BA  @-12, {88
        SPL.F   #-6, #204
        SPL.F   #3, @0
        DJN.X   >18, >-5
        DJN.F   <13, }105
        ADD.F   #10, }4
        SPL.X   @-2, }11
        DJN.F   <-13, <105
        NOP.I   @9, <16
        ADD.F   #10, *4
        SPL.F   #-1, @0
        SNE.B   @-165, <1
        SPL.X   @2, }11
        DJN.F   <-16, <-143
        DJN.X   >18, *-13
        DJN.AB  @-105, @-14
