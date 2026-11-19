;redcode
;name Rusty Magpie III
;author 42evolve
;strategy evolved, warrior 740 of run seed 206, batch 39
;strategy 87.9 against 100 holdout warriors, 83.4 against the panel
;strategy from run tsd/island-06, 18th November 2026, --pushoff pareto-sd
        ORG     0
        SPL.B   #17, *19
        DJN.X   #14, {7
        SLT.F   @-308, *-4
        SEQ.F   @5, }1
        SPL.A   }0, }-1
        SPL.X   #391, <303
        JMN.A   }-2, }-1
        DJN.A   #1, >1
        SEQ.F   @-10, }0
        SPL.X   #391, <-190
        SPL.A   }0, }-1
        SPL.X   #391, <-190
        SPL.A   }0, }-1
        DJN.A   #1, >1
        SNE.I   <-48, }9
        DIV.A   @2, <-8
        DJN.BA  #1, >1
        SPL.X   #391, <303
        SPL.A   *-4, >279
        SPL.A   }0, }-2
