;redcode
;name Quiet Yak X
;author 42evolve
;strategy evolved, warrior 1463 of run seed 208, batch 89
;strategy 82.3 against 100 holdout warriors, 87.8 against the panel
;strategy from run ta/island-08, 18th November 2026, --pushoff pareto-age
        ORG     0
        DJN.F   #3, <3
        SPL.AB  #1, <-361
        JMN.AB  <3, @-3
        JMZ.I   >-260, #-5
        SEQ.I   >91, #220
        NOP.X   <14, {10
        SPL.AB  #13, <-8
        JMP.A   {-11, #-329
        SEQ.A   }-88, >4
        SNE.A   }-88, >4
        SNE.A   }88, >1
        SNE.A   }340, >1
        SLT.B   @13, {3
        SNE.A   <-88, >5
        DJN.F   #-2, <-3
        SNE.A   }-88, >1
        DJN.F   }-88, >-3
        SLT.B   #1, <1
        SUB.B   #13, <3
