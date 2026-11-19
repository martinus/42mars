;redcode
;name Mutant Mole IX
;author 42evolve
;strategy evolved, warrior 1549 of run seed 206, batch 89
;strategy 73.7 against 100 holdout warriors, 74.5 against the panel
;strategy from run tp/island-06, 18th November 2026, --pushoff pareto
        ORG     0
        DJN.X   #14, {-5
        SNE.X   <-48, }9
        CMP.B   }15, $15
        DJN.X   #-139, {-2
        ADD.I   {-8, <0
        JMN.AB  #-1, *-190
        SNE.X   *205, {10
        SUB.B   <6, }12
        SPL.BA  #1, >1
        SUB.AB  >-10, *58
        DJN.X   #14, {-2
        DJN.I   #324, >-6
        JMP.AB  #-5, $2
        JMP.X   <-311, {-6
        SNE.X   <-48, }5
        DJN.I   #-324, >-2
        CMP.X   }-9, *-1
        SEQ.F   @5, }0
        CMP.B   }-7, >-2
        SEQ.F   @5, }0
