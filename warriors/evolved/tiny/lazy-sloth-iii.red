;redcode
;name Lazy Sloth III
;author 42evolve
;strategy evolved, warrior 585 of run seed 207, batch 29
;strategy 96.5 against 100 holdout warriors, 69.1 against the panel
;strategy from run tsc5/island-07, 18th November 2026, --pushoff pareto-sd --clear 5
        ORG     2
        DJN.BA  #16, {-2
        JMZ.A   {0, >0
        SPL.BA  #0, @-12
        MUL.X   {282, {0
        DJN.F   #16, {-1
        JMZ.A   {0, }-3
        JMP.A   *7, }0
