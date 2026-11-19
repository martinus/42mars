;redcode
;name Restless Hydra VI
;author 42evolve
;strategy evolved, warrior 1669 of run seed 213, batch 99
;strategy 83.2 against 100 holdout warriors, 93.2 against the panel
;strategy from run tp/island-13, 18th November 2026, --pushoff pareto
        ORG     0
        DJN.X   #-3, {0
        SPL.A   #96, #39
        JMZ.A   {-82, <4
        SPL.B   $0, >7
        SPL.F   $-4, >-47
        DJN.X   #398, {-2
        JMP.I   @1, <11
        JMN.X   @-381, @-7
        DIV.A   }197, @14
        JMZ.A   {-82, <3
        SPL.B   $0, >7
        SPL.AB  $-11, >-47
        JMP.AB  }-5, $-3
        SPL.A   #96, #1
        JMN.I   @-1, #2
        JMZ.B   *303, }-3
        DJN.X   #-3, *-2
        SEQ.I   @12, #-351
        CMP.BA  @1, <1
        ADD.A   {-2, *-7
