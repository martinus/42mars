;redcode-94nop
;name Bouncy Kitten III
;author 42evolve
;strategy evolved, warrior 459 of run seed 43, batch 19
;strategy 66.8 against 100 holdout warriors, 56.2 against the panel
;strategy from run i55-43, 17th November 2026, --pushoff value
        ORG     1
        ADD.AB  >-2100, {-2573
        NOP.BA  *546, <1
        NOP.I   >1681, @1
        DJN.F   #-15, }7
        NOP.I   >9, @1
        DJN.F   #-15, }7
        MOD.I   @5, $7
        NOP.I   >9, @-2
        JMZ.AB  }3244, *2
        SUB.AB  @-9, *0
        JMP.AB  @-9, @-2205
        ADD.A   <-7, <3293
        ADD.AB  {-15, {8
        DIV.X   {-13, }-7
        SPL.AB  $4, {11
