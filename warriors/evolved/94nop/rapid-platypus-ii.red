;redcode-94nop
;name Rapid Platypus II
;author 42evolve
;strategy evolved, warrior 581 of run seed 43, batch 29
;strategy 74.0 against 100 holdout warriors, 65.2 against the panel
;strategy from run i20-43, 17th November 2026, --pushoff value
        ORG     0
        NOP.BA  *546, <1
        NOP.I   >10, @1
        DJN.F   #-15, }7
        NOP.I   >9, <1
        DJN.F   #-15, }7
        SUB.AB  @-5, *0
        SUB.AB  @-6, *0
        SPL.A   {2, }-7
        NOP.AB  #8, @1273
        DJN.BA  }1979, }-9
        SLT.AB  <-1588, $-216
        MOD.AB  @-11, @-2205
