;redcode-94nop
;name Vicious Hyena V
;author 42evolve
;strategy evolved, warrior 623 of run seed 48, batch 29
;strategy 88.9 against 100 holdout warriors, 72.9 against the panel
;strategy from run i55-48, 17th November 2026, --pushoff value
        ORG     0
        SPL.B   $-1739, $-2445
        DJN.I   #-9, <-1
        SPL.X   #-3, *-1762
        SPL.BA  {-2, *-2423
        DJN.BA  #-9, <-4
        MOD.AB  $17, #-16
        MUL.I   *-2, {16
        DJN.F   #-5, <3902
        DJN.BA  #-9, <-7
        JMP.BA  {-2, @5
        CMP.I   $0, {15
        SEQ.X   *-15, }-9
        JMZ.A   *2, >11
        NOP.A   {6, @-13
        DJN.A   {3, <1314
        SPL.B   $-1739, $-2445
        DJN.BA  #-9, <1
        SPL.X   #-3, *-1762
        SUB.A   @-2401, >-18
        SPL.B   $-1739, $-2445
        DJN.BA  #88, <-18
        DIV.X   @2977, {3
        SPL.X   #-15, >4
        NOP.A   {6, @-23
        DJN.A   {3, <1312
        MUL.I   *-2, {17
