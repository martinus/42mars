;redcode
;name Lazy Cyclops VIII
;author 42evolve
;strategy evolved, warrior 1292 of run seed 209, batch 79
;strategy 90.6 against 100 holdout warriors, 87.6 against the panel
;strategy from run ta/island-09, 18th November 2026, --pushoff pareto-age
        ORG     7
        SPL.AB  #-13, *-2
        DJN.I   #-150, <12
        JMN.F   @0, #-166
        DAT.BA  #-258, {-8
        MOV.A   <-343, $7
        JMP.F   @-4, #-4
        DAT.A   >7, @-49
        SUB.F   {-5, *-5
        SPL.BA  {-3, #-4
        DAT.BA  >284, @-49
        MOV.B   }-5, <3
        DIV.X   *-3, <15
        SNE.A   <-11, {1
        MUL.AB  }100, >-10
        SUB.I   #1, >-6
        SNE.B   @-124, }8
        NOP.BA  {-8, {1
        SUB.X   #1, >-6
        SNE.B   @-124, }-13
        DIV.F   <-2, <-1
