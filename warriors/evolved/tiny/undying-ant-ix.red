;redcode
;name Undying Ant IX
;author 42evolve
;strategy evolved, warrior 1413 of run seed 208, batch 89
;strategy 90.3 against 100 holdout warriors, 90.0 against the panel
;strategy from run tsc5/island-08, 18th November 2026, --pushoff pareto-sd --clear 5
        ORG     0
        SPL.AB  #16, <16
        DJN.X   #-5, <-5
        MOD.B   @-332, *5
        SLT.X   $-375, #-329
        SNE.I   <-8, >-8
        SPL.A   $10, #68
        SPL.B   #1, <-361
        SPL.BA  @8, <392
        NOP.X   <-120, {10
        SPL.AB  #7, <7
        DJN.B   {1, @1
        NOP.AB  <5, <-7
        SPL.F   >-15, @-1
        JMN.A   *3, $-14
        ADD.AB  #5, <-2
        ADD.F   $-15, {0
        SPL.A   $-1, #69
        JMP.X   >-10, #6
        SUB.AB  #16, >16
        SPL.X   >-171, @59
