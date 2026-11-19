;redcode
;name Fickle Virus
;author 42evolve
;strategy evolved, warrior 437 of run seed 202, batch 19
;strategy 97.1 against 100 holdout warriors, 77.5 against the panel
;strategy from run tsc10/island-02, 18th November 2026, --pushoff pareto-sd --clear 10
        ORG     0
        SPL.X   #0, @14
        DJN.I   #-20, {2
        DJN.I   #-16, {-6
        DJN.A   *-295, {388
        DJN.I   #-16, {-6
        SLT.F   {13, }14
        SPL.AB  #0, @-104
        MOD.AB  }0, }0
        SPL.BA  <5, {7
        DJN.I   #-20, {2
        DJN.I   #-16, <-6
        DJN.A   *-295, {388
        DJN.I   #-16, {-6
        JMP.BA  $3, *246
        MOD.AB  }-1, }-1
        JMP.BA  $3, *246
        DAT.AB  {-16, @356
