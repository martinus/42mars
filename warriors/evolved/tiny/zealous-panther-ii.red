;redcode
;name Zealous Panther II
;author 42evolve
;strategy evolved, warrior 1701 of run seed 203, batch 99
;strategy 91.2 against 100 holdout warriors, 93.5 against the panel
;strategy from run tsc5/island-03, 18th November 2026, --pushoff pareto-sd --clear 5
        ORG     0
        SPL.BA  *0, $0
        DJN.F   #-229, {1
        SEQ.A   @-3, }16
        SPL.BA  *0, $0
        SPL.X   #286, {-352
        DIV.X   #-288, {-4
        MOV.F   >-6, <-15
        MOV.I   <12, }219
        DJN.A   <11, *7
        DIV.B   }10, #-4
        JMP.F   *-117, #-3
        JMZ.I   $-349, {6
        NOP.BA  }343, *279
        JMN.I   }-3, *-16
        DJN.BA  *0, $0
        DJN.F   #106, }-8
        SPL.I   }139, $-227
        SUB.BA  >2, >2
        SUB.F   >-9, $-8
        DJN.B   <0, >-6
