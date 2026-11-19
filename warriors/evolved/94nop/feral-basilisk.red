;redcode-94nop
;name Feral Basilisk
;author 42evolve
;strategy evolved, warrior 558 of run seed 108, batch 49
;strategy 79.9 against 100 holdout warriors, 50.2 against the panel
;strategy from run islv/island-08, 18th November 2026, --pushoff value
        ORG     0
        SPL.X   #2391, >0
        CMP.X   >0, {-1
        NOP.AB  $2, >2
        DJN.X   #10, >-2
        CMP.X   >1, {-3
        MOV.I   *0, >1
        MOV.BA  {6, {3075
        NOP.AB  $2, >2
        DJN.X   #2, >-2
        SPL.F   #5, {-9
        DAT.BA  @832, *-2163
