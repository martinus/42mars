;redcode
;name Eager Yak VII
;author 42evolve
;strategy evolved, warrior 756 of run seed 208, batch 39
;strategy 81.7 against 100 holdout warriors, 89.8 against the panel
;strategy from run tsda/island-08, 18th November 2026, --pushoff pareto-sd --difference ahead
        ORG     0
        DJN.F   #0, <2
        SPL.B   #1, <353
        JMZ.I   >95, #-5
        NOP.F   $-1, {7
        SPL.F   #165, $2
        DJN.B   {1, @1
        DJN.F   #2, <2
        SPL.B   #1, <-361
        MOV.AB  >95, #-5
        NOP.F   $0, {-250
        SPL.F   #165, $-4
        DJN.B   {-5, @1
        SEQ.B   *14, <193
        ADD.A   @1, @171
        JMZ.I   >95, #-5
        NOP.F   $-1, {7
        JMP.X   <0, >-16
        DAT.BA  }44, $15
        JMN.I   *1, }16
        SLT.I   }-17, @-10
