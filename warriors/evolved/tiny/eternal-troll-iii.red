;redcode
;name Eternal Troll III
;author 42evolve
;strategy evolved, warrior 759 of run seed 207, batch 39
;strategy 95.4 against 100 holdout warriors, 78.9 against the panel
;strategy from run tsc10/island-07, 18th November 2026, --pushoff pareto-sd --clear 10
        ORG     0
        SPL.AB  #-74, #219
        DJN.F   #1, {0
        JMP.I   #12, $8
        JMZ.BA  @371, *0
        JMZ.AB  *-1, @0
