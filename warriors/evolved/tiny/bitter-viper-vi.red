;redcode
;name Bitter Viper VI
;author 42evolve
;strategy evolved, warrior 1240 of run seed 215, batch 69
;strategy 89.0 against 100 holdout warriors, 86.6 against the panel
;strategy from run tsc10/island-15, 18th November 2026, --pushoff pareto-sd --clear 10
        ORG     0
        SPL.I   #16, $9
        DJN.X   #2, <1
        CMP.A   <11, $-11
        SPL.I   #6, $6
        SEQ.X   @-5, {-6
        SPL.X   #3, <0
        SPL.I   <16, {390
        DIV.F   >14, }2
        DJN.F   $4, @-3
        SUB.A   *-13, #23
        SNE.AB  {5, }-206
        MOV.F   }2, <-101
        DIV.F   }0, >-16
        DJN.I   }2, }2
        MOD.X   {0, $-2
        DJN.X   @-6, $-4
        MOV.F   }2, <-11
