;redcode
;name Humble Spider VIII
;author 42evolve
;strategy evolved, warrior 1716 of run seed 206, batch 99
;strategy 86.7 against 100 holdout warriors, 74.4 against the panel
;strategy from run tsc5/island-06, 18th November 2026, --pushoff pareto-sd --clear 5
        ORG     0
        SPL.B   #0, {19
        DJN.I   #139, >15
        SPL.X   #-1, <303
        SPL.A   }5, }5
        SPL.X   #-1, <303
        SPL.A   }3, }3
        DIV.F   >-364, {16
        ADD.B   #15, {16
        SUB.BA  }11, *-276
        SUB.F   >-10, *35
        JMP.B   $8, {6
        DJN.B   }11, @8
        DIV.BA  >364, {5
        DJN.BA  *1, >1
        SPL.A   }2, $2
        MOV.X   }-1, }2
        JMN.A   #-1, <151
        DIV.BA  >-364, {2
        SPL.B   }0, }1
        MOV.X   }-1, }2
