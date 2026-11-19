;redcode
;name Sleepy Spider XI
;author 42evolve
;strategy evolved, warrior 1567 of run seed 206, batch 89
;strategy 95.3 against 100 holdout warriors, 91.7 against the panel
;strategy from run tsda/island-06, 18th November 2026, --pushoff pareto-sd --difference ahead
        ORG     1
        NOP.B   >-15, @-254
        SPL.I   #324, @11
        DJN.X   #14, {-2
        SPL.I   #324, >-1
        SPL.I   #324, >-1
        SPL.I   #-16, >-251
        SUB.AB  $-11, *-352
        SUB.F   }10, >7
        SPL.BA  <-1, *2
        MOV.I   >324, >0
        DIV.F   @10, *12
        CMP.X   }2, @2
        SUB.AB  >-10, $-36
        SPL.I   #324, >-1
        DJN.A   #1, >1
        MOV.I   #324, >0
        JMZ.AB  }13, }7
        SLT.BA  {-364, {9
