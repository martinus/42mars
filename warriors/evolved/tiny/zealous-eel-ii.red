;redcode
;name Zealous Eel II
;author 42evolve
;strategy evolved, warrior 743 of run seed 214, batch 39
;strategy 81.0 against 100 holdout warriors, 70.3 against the panel
;strategy from run tsc5/island-14, 18th November 2026, --pushoff pareto-sd --clear 5
        ORG     0
        SPL.X   #13, }0
        DJN.X   #13, }0
        MUL.F   }16, <390
        SPL.X   #14, {5
        JMZ.A   #-13, }12
        SPL.I   #12, }5
        JMP.B   <2, >275
        DJN.I   #13, }0
        SPL.X   <-164, *8
        DAT.X   $-8, <-6
        JMZ.A   #4, *0
        JMZ.A   #-13, }5
        SPL.I   #5, {5
        JMP.B   <2, >275
        MUL.X   <-164, *8
        DAT.X   #-8, <-3
        JMZ.A   #4, >0
        JMP.I   <317, }238
        ADD.BA  }-2, <-3
        JMP.B   <2, >275
