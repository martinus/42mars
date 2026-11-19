;redcode
;name Bouncy Pangolin II
;author 42evolve
;strategy evolved, warrior 1401 of run seed 208, batch 79
;strategy 94.0 against 100 holdout warriors, 99.2 against the panel
;strategy from run tsc10/island-08, 18th November 2026, --pushoff pareto-sd --clear 10
        ORG     0
        JMZ.I   >1, #-8
        DJN.F   #-1, <-1
        SPL.B   #-1, <-361
        SPL.F   #-4, $6
        SPL.F   }-4, *8
        SPL.AB  #-5, <-361
        MOV.I   >-102, >-280
        SPL.AB  #-8, <-361
        MOV.I   >-102, >305
        DJN.F   >-8, #-4
        JMZ.F   >4, >-280
        SEQ.B   }7, *11
        SLT.I   *15, @-3
        DJN.F   #3, <3
        ADD.F   {14, {-14
