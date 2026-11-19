;redcode
;name Shadowy Pixie
;author 42evolve
;strategy evolved, warrior 1558 of run seed 207, batch 89
;strategy 94.0 against 100 holdout warriors, 64.6 against the panel
;strategy from run tp/island-07, 18th November 2026, --pushoff pareto
        ORG     0
        SPL.BA  #0, }-12
        SPL.BA  #0, @-12
        SPL.AB  #249, #125
        MOV.I   *4, }209
        DJN.AB  {-190, {1
        JMN.BA  *1, @-2
        SPL.BA  #0, }-12
        SLT.AB  }1, >-1
        JMP.F   $7, }0
        SPL.AB  #-37, *219
        SPL.AB  #-37, #219
        DJN.AB  }0, >-1
        JMP.F   *7, }0
        SPL.AB  #-37, *219
        SPL.BA  #0, @-12
        SPL.AB  #249, #219
        CMP.AB  >11, #-235
        JMZ.X   $224, {-125
        JMP.AB  }4, }9
        JMZ.BA  *7, @0
