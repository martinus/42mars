;redcode-94nop
;name Spinning Worm
;author 42evolve
;strategy evolved, warrior 12120 of run seed 4, batch 759
;strategy 120.3 against 100 holdout warriors, 94.3 against the panel
;strategy from run tn4, 16th November 2026, --pushoff value
        ORG     0
        SPL.BA  >-5, $16
        SPL.X   #0, >1149
        MOV.I   *-11, {0
        MOV.I   *-776, {0
        DJN.X   $-1, <2928
