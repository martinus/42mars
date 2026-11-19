;redcode
;name Bouncy Scorpion VII
;author 42evolve
;strategy evolved, warrior 1280 of run seed 209, batch 79
;strategy 94.2 against 100 holdout warriors, 88.3 against the panel
;strategy from run tp/island-09, 18th November 2026, --pushoff pareto
        ORG     1
        SPL.A   #-13, }12
        ADD.I   <2, }1
        SPL.I   #0, *369
        DJN.X   #0, <0
        SPL.X   #0, *369
        CMP.I   @11, #-250
        CMP.F   $-1, #0
        SPL.X   #0, *369
        CMP.X   *1, #1
        JMN.I   <-210, $-339
        SPL.X   #0, <375
        MOV.I   <2, }1
        SPL.AB  #0, *369
        ADD.I   <2, }1
        SPL.X   $0, *369
        DJN.F   #0, <0
        SNE.AB  *-13, #-1
        NOP.AB  $-9, {-2
        CMP.F   $-1, *-2
        CMP.X   *-9, {-11
