;redcode-94nop
;name Haunted Lynx XVIII
;author 42evolve
;strategy evolved, warrior 34473 of run seed 2, batch 2149
;strategy 107.1 against 100 holdout warriors, 96.0 against the panel
;strategy from run np2, 16th November 2026, --pushoff value
        ORG     0
        SPL.X   #13, $-3288
        ADD.B   #1891, $9
        MOV.I   $7, >8
        DJN.B   $-2, #800
        SPL.X   >-390, }1
        SNE.A   }15, *1
        MOD.X   }8, {-7
        ADD.F   >0, #-2
        SNE.F   $2, >10
        DAT.F   >1, }1
        DJN.F   #0, #2334
        DJN.I   @1165, >-3
        SPL.X   #14, $-3288
        DJN.F   <-10, $-12
        ADD.I   #1891, $-4
        SPL.X   #11, $-3288
        MOD.AB  $-3590, }-24
        ADD.I   #1891, $20
        MOD.A   *2, *1396
        DAT.X   {-7, {-2
        JMN.B   >-9, <-13
        DJN.I   @1165, >-3
        SPL.X   #14, $-3288
        DJN.F   <-20, $-22
        ADD.I   #1891, $-4
        SPL.X   #11, $-3288
