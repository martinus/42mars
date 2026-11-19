;redcode-94nop
;name Spicy Mammoth
;author 42evolve
;strategy evolved, warrior 3106 of run seed 1, batch 199
;strategy 89.9 against 100 holdout warriors, 55.4 against the panel
;strategy from run n2, 15th November 2026, --pushoff value
        ORG     1
        MOD.I   *13, <1426
        SPL.I   #-1456, <8
        SLT.F   <11, *1
        SPL.I   #-1456, <8
        SPL.I   #-1456, <8
        MOV.I   *13, <1426
        MOV.I   *13, <-349
        DJN.F   #8, <2
        MUL.BA  *7, {-3555
        SEQ.A   {0, *9
        CMP.B   {-17, #822
        SEQ.X   *1, #1031
        SLT.A   #3, }-2941
        JMN.I   *-3839, *-3089
        ADD.X   {1, #-5
        DIV.BA  *-10, }-13
        CMP.B   }-16, #822
        SEQ.X   *-5, #1031
        SPL.F   }-18, #-8
        SEQ.AB  {-11, *9
