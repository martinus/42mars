;redcode
;name Icy Lemur II
;author 42evolve
;strategy evolved, warrior 592 of run seed 209, batch 29
;strategy 93.8 against 100 holdout warriors, 77.5 against the panel
;strategy from run tsd/island-09, 18th November 2026, --pushoff pareto-sd
        ORG     0
        SPL.X   #30, {348
        DJN.F   #-15, {0
        SPL.X   #30, {348
        DJN.F   #-15, {0
        SPL.X   #30, {348
        MOV.F   #-15, {0
        SPL.X   >10, $4
        CMP.BA  *0, *0
        NOP.I   $-4, {-397
        SPL.X   >10, $-2
        CMP.BA  *0, *0
        DAT.X   {-199, @-8
        SPL.X   #30, {348
        DJN.A   #4, {165
        SEQ.B   >10, >272
        DJN.B   {-1, <7
        NOP.I   $-4, {-397
        SPL.X   >10, $-1
        CMP.BA  *0, *0
        NOP.I   $-19, {-397
