;redcode
;name Neon Moose II
;author 42evolve
;strategy evolved, warrior 1698 of run seed 207, batch 99
;strategy 98.6 against 100 holdout warriors, 96.2 against the panel
;strategy from run tsda/island-07, 18th November 2026, --pushoff pareto-sd --difference ahead
        ORG     0
        SPL.A   #0, >3
        DJN.X   #16, <-11
        ADD.AB  }5, <-232
        MUL.X   <10, <6
        MOD.F   #-15, }7
        SPL.B   #-118, *303
        MOV.I   $-42, <11
        DAT.A   *4, *-11
        DIV.X   >-5, #-5
        MOD.B   >10, #-317
        DAT.AB  #3, >3
        SEQ.I   {-13, <-7
        SNE.BA  @5, #-320
        MUL.B   {383, *-7
        MOD.F   <-3, *-9
        JMN.A   *-1, }326
        SLT.A   <-3, }-13
        JMP.F   }-3, }0
        MUL.AB  #16, <6
        NOP.B   }16, }-11
