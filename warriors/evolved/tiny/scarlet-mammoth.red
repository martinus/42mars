;redcode
;name Scarlet Mammoth
;author 42evolve
;strategy evolved, warrior 1059 of run seed 214, batch 59
;strategy 97.1 against 100 holdout warriors, 102.1 against the panel
;strategy from run tsda/island-14, 18th November 2026, --pushoff pareto-sd --difference ahead
        ORG     2
        NOP.A   #12, $-38
        DIV.I   #-320, <-2
        DJN.X   #-1, <0
        SPL.I   #5, {-113
        SPL.B   #-13, {375
        SPL.I   #-208, {2
        MOV.I   @-8, <-2
        JMP.X   <3, *13
        MUL.I   >-78, @-146
        MUL.I   >6, {-146
        SPL.B   #-4, {375
        ADD.AB  >-16, }188
        SLT.B   }397, <11
        MOV.AB  >-8, }-15
        SPL.I   #5, {5
        MOV.BA  }-18, <14
        DIV.F   #-17, $-19
        MUL.I   >-6, {-146
        ADD.BA  $-16, <14
        DIV.F   #-19, #-17
