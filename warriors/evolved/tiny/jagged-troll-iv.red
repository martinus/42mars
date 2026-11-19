;redcode
;name Jagged Troll IV
;author 42evolve
;strategy evolved, warrior 1548 of run seed 213, batch 89
;strategy 103.9 against 100 holdout warriors, 109.6 against the panel
;strategy from run ta/island-13, 18th November 2026, --pushoff pareto-age
        ORG     0
        SPL.B   #99, $1
        DJN.X   #-3, {0
        SPL.I   #-1, >17
        SPL.F   #-371, >15
        SPL.BA  #96, #0
        MOV.I   *1, >14
        DJN.F   {-1, >5
        NOP.I   *312, {9
        JMN.B   >-1, #12
        SEQ.B   >13, @324
        NOP.X   $-13, <286
        SUB.X   {2, >2
        JMN.X   $42, <-42
        DJN.I   $-340, <7
        SPL.F   #-55, >4
        JMP.F   {1, >5
        SPL.A   #96, #0
        MOV.I   }0, >12
        DJN.F   {1, >323
        JMP.F   *2, >5
