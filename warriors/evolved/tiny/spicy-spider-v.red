;redcode
;name Spicy Spider V
;author 42evolve
;strategy evolved, warrior 1067 of run seed 205, batch 59
;strategy 92.7 against 100 holdout warriors, 76.4 against the panel
;strategy from run tv/island-05, 18th November 2026, --pushoff value
        ORG     0
        SPL.X   #7, *181
        DJN.F   #7, {-5
        NOP.BA  >-353, $-1
        DJN.F   #8, {12
        SPL.I   }4, *4
        SNE.I   #18, <12
        MOD.F   #1, {12
        JMP.B   <395, {2
        SNE.I   }18, <12
        MUL.I   #2, $14
        DJN.I   $-2, #54
        NOP.A   *-213, <162
        NOP.A   *-213, <162
        JMN.B   @-13, @15
