;redcode
;name Nocturnal Sloth X
;author 42evolve
;strategy evolved, warrior 1522 of run seed 212, batch 89
;strategy 91.3 against 100 holdout warriors, 86.0 against the panel
;strategy from run ta/island-12, 18th November 2026, --pushoff pareto-age
        ORG     0
        SPL.A   #10, }294
        DJN.X   #17, {-4
        SPL.X   {8, }294
        SPL.BA  {7, }294
        SPL.X   #-386, >6
        SPL.X   {5, }294
        SPL.X   #4, >4
        SPL.F   {384, }294
        SPL.X   #-386, >4
        SPL.BA  {3, }294
        NOP.F   #-1, @0
        SUB.I   @16, }-15
        JMZ.A   *-8, *0
        JMP.I   $-10, @-1
        SUB.I   $-16, }11
        SPL.X   {-5, #294
        SPL.X   #-382, >-6
        MOV.B   *0, @1
        SUB.I   @15, }-15
        JMP.A   *277, {-1
