;redcode
;name Soggy Bison
;author 42evolve
;strategy evolved, warrior 594 of run seed 211, batch 29
;strategy 91.6 against 100 holdout warriors, 80.0 against the panel
;strategy from run tsc10/island-11, 18th November 2026, --pushoff pareto-sd --clear 10
        ORG     0
        SPL.BA  #8, {-323
        DJN.I   #14, <-11
        ADD.B   @6, $10
        DJN.X   }10, #-15
        SUB.A   @-359, {6
        MUL.A   {54, {-9
        SEQ.F   *12, >12
        JMP.X   }-10, $-7
        DJN.X   }10, #-15
        SUB.A   @-359, {6
        MUL.A   {54, {-9
        SEQ.F   *12, >0
        JMP.X   }-10, $-7
        ADD.X   @4, #49
        DAT.A   {3, @-4
        DIV.I   $-7, }4
        SUB.A   @-359, {-264
        MOV.BA  >5, }0
        ADD.X   <10, #-13
        MOV.I   #7, $1
