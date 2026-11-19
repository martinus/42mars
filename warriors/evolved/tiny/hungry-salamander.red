;redcode
;name Hungry Salamander
;author 42evolve
;strategy evolved, warrior 275 of run seed 208, batch 9
;strategy 84.7 against 100 holdout warriors, 68.0 against the panel
;strategy from run tv/island-08, 18th November 2026, --pushoff value
        ORG     2
        JMZ.I   >95, #-5
        SNE.A   }-88, >5
        DJN.F   #-2, <-2
        SPL.B   #1, <-361
        DJN.F   #-4, <-4
        SLT.B   @13, {3
        SNE.I   <-8, >-6
        DJN.F   >-5, {-4
        SNE.A   <-16, #15
        SPL.B   #1, <-361
        SLT.B   @13, {3
        SNE.I   <-8, >-11
        SLT.X   }1, @-79
        DJN.F   >-9, {-4
        JMN.I   $1, }16
        SLT.I   @-12, @-9
