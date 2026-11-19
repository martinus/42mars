;redcode
;name Hyper Heron VI
;author 42evolve
;strategy evolved, warrior 1281 of run seed 204, batch 79
;strategy 79.0 against 100 holdout warriors, 62.5 against the panel
;strategy from run tp/island-04, 18th November 2026, --pushoff pareto
        ORG     0
        SPL.B   #-7, }0
        SPL.B   #7, }0
        SPL.X   #-9, }-2
        DJN.BA  {3, {3
        JMP.A   >1, #1
        MOV.B   $213, }8
        SPL.B   #-7, }0
        DJN.X   <-255, >-362
        SPL.B   #-7, }0
        DJN.BA  >1, *3
        MOV.B   $208, }8
        DJN.A   $4, *-11
        MOD.B   <10, *-12
        JMP.I   @-5, #336
        DIV.B   $209, }8
        JMZ.BA  {-1, >2
        DJN.I   #-1, $-8
        JMP.F   @-16, <5
        SPL.B   *-18, }0
        DIV.B   $209, @8
