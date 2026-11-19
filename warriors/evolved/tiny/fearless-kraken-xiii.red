;redcode
;name Fearless Kraken XIII
;author 42evolve
;strategy evolved, warrior 1666 of run seed 209, batch 99
;strategy 93.3 against 100 holdout warriors, 83.0 against the panel
;strategy from run tsda/island-09, 18th November 2026, --pushoff pareto-sd --difference ahead
        ORG     1
        DAT.A   <-6, <-21
        SPL.A   #-11, *4
        DJN.F   #11, <-2
        MOV.A   $-337, {5
        SUB.I   *-16, $7
        DJN.B   *-342, <15
        JMN.F   $0, *-1
        JMN.F   $0, *-13
        DAT.B   #258, {-138
        SPL.F   *10, {-1
        NOP.BA  {4, @4
        ADD.F   #-337, {-9
        CMP.I   #-64, $5
        SNE.I   }0, $5
        CMP.A   #0, $3
        NOP.BA  {-297, @-4
        ADD.BA  *-16, {-101
        MOV.A   #-337, {5
        JMP.F   @226, @-13
        SLT.BA  {0, $-4
